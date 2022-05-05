"use strict";

const child_process = require('child_process')
const fs = require('fs')
const crypto = require('crypto')

const express = require('express')

// retrieve contents from environment variables
const REPOSITORY_URL = process.env.DRONE_YAML_REPOSITORY_URL
const PORT = process.env.DRONE_SERVER_PORT || 3000
const DATA_FOLDER = process.env.DRONE_DATA_FOLDER || 'data'
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET
const WEBHOOK_SIGNATURE_HEADER = process.env.WEBHOOK_SIGNATURE_HEADER || 'X-Gitea-Signature'

// check that repository URL is set
if (!REPOSITORY_URL) {
    console.error('repository URL is not given')
    process.exit(1)
}

// declare variable for holding configuration file index
var index

// create express app and add JSON parser for body to get data from Drone
const app = express()
var rawBodySaver = function (req, res, buf, encoding) {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8')
    }
}
app.use(express.json({verify: rawBodySaver}))

if (!WEBHOOK_SECRET) {
    console.warn('webhook secret not given. webhook /update endpoint disabled.')
} else {
    // Pull latest data from repository and update cached index
    app.post('/update', async (req, res) => {
        console.log(`triggering update for configuration repository`)

        // Verify webhook signature
        const signature_header = req.get(WEBHOOK_SIGNATURE_HEADER)
        const signature_calculated = crypto.createHmac('sha256', WEBHOOK_SECRET)
            .update(req.rawBody)
            .digest('hex')

        const signature_calculated_buf = Buffer.from(signature_calculated, "utf8")
        const signature_header_buf = Buffer.from(signature_header, "utf8")
        if (signature_calculated_buf.length !== signature_header_buf.length
        || !crypto.timingSafeEqual(signature_calculated_buf, signature_header_buf)) {
            console.error('Invalid webhook signature.')
            res.status(403).json({'status': 'error', 'msg': 'invalid webhook signature'})
            return
        }

        try {
            await fetchData()
            index = await readIndex()
            res.json({'status': 'ok'})
        } catch (error) {
            res.json({'status': 'error', 'msg': error})
        }
    })
}

// Drone will send requests as POST to the root
app.post('/', (req, res) => {
    // retrieve URL from request and check whether entry exists in index
    console.log(`request configuration for ${req.body.repo.git_http_url}`)
    let filename = index[req.body.repo.git_http_url]
    if (filename) {
        // entry exists, read content from referenced file
        console.log('configuration exists, sending file content')
        fs.readFile(`${DATA_FOLDER}/${filename}`, 'utf8', (error, data) => {
            if (error) {
                // error appeared during reading, let Drone use standard config file
                console.error(`error reading file ${filename}: ${error}`)
                res.status(204).send()
            } else {
                // return content to be used by Drone
                res.json({
                    'data': data
                })
            }
        })
    } else {
        // there is no entry in the index, let Drone use standard config file
        console.log('configuration does not exist, use default from source repository')
        res.status(204).send()
    }
})

/**
 * Fetches current data from the repository.
 */
async function fetchData() {
    return new Promise(resolve => {
        // check whether the repository currently exists
        if (fs.existsSync(DATA_FOLDER)) {
            // repository exists, update the repository
            console.log('data exists, updating repository...')
            child_process.exec(`cd ${DATA_FOLDER} && git pull`, (error, stdout, stderr) => {
                if (error) throw error
                console.log('fetched repository')
                resolve()
            })
        } else {
            // repository does not exists, clone the repository
            console.log('data not existing, cloning repository...')
            child_process.exec(`git clone ${REPOSITORY_URL} ${DATA_FOLDER}`, (error, stdout, stderr) => {
                if (error) throw error
                console.log('cloned repository')
                resolve()
            })
        }
    })
}

/**
 * Reads the index of the data folder from the file index.json.
 * 
 * @return {Object} index of the data folder
 */
async function readIndex() {
    return new Promise(resolve => {
        fs.readFile(`${DATA_FOLDER}/index.json`, (error, data) => {
            if (error) throw error
            resolve(JSON.parse(data))
        })
    })
}

// startup server
(async function() {
    try {
        console.log('starting up server, updating data...')
        await fetchData()
        console.log('fetchdata finished')
        index = await readIndex()
        console.log('data loaded, start listening...')
        app.listen(PORT, () => {
            console.log('started server')
        })
    } catch(error) {
        console.error(`error appeared: ${error}`)
    }
})()
