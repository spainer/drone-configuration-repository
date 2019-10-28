# Drone Configuration Repository

This is a configuration plugin for [Drone](https://drone.io/). This plugin makes it possible to overwrite the pipeline configuration of a repository. It is possible to add a pipeline configuration to a repository without altering the repository, e.g. when you have no rights to add a pipeline configuration. The configurations to overwrite or add are stored in a Git repository.

## Installation

The configuration plugin is available at [Docker Hub](https://hub.docker.com/r/svenpainer/drone-configuration-repository). Therefore, the easiest thing is to use a docker-compose file like the following:

```yml
version: '3.7'

services:
  drone:
    image: 'drone/drone:1'
    environment:
      - DRONE_YAML_ENDPOINT=http://drone_yaml_repository:3000/
  
  drone_yaml_repository:
    image: 'svenpainer/drone-configuration-repository'
    environment:
      - DRONE_YAML_REPOSITORY_URL=<URL_TO_REPOSITORY>
```

This only shows the most basic setup. Please be sure to replace `<URL_TO_REPOSITORY>` with the URL to the Git repository holding the configuration files. This URL will be used for cloning the repository inside the container.

## Repository

The plugin gets the pipeline configurations from a Git repository. This repository must contain a file `index.json` mapping the configuration files to repositories in the following manner:

```json
{
  "http_clone_url_of_repo1": "config_file1.yml",
  "http_clone_url_of_repo2": "config_file2.yml"
}
```

The files consists of a JSON object mapping the HTTP clone URLs of repositories to configuration file names. These configuration files have to exist in the repository.

When Drone asks for a repository that is not defined in `index.json`, it will fallback to look for the standard configuration file (normally `.drone.yml`) inside the source repository. Therefore, you only have to define configurations if you want to overwrite the normal behaviour. As Drone first asks this service for a configuration, it is possible to define a configuration for a source repository that has no configuration file in it.

As the plugin clones or updates the repository at startup, you have to restart the service when you make any changes to the repository.

## Configuration

The following environment variables can be set to alter the behaviour of the plugin:

Environment Variable | Default Value | Description
---------------------|---------------|------------
DRONE_YAML_REPOSITORY | | The clone URL of the repository containing the configurations. **This variable is required.**
DRONE_SERVER_PORT | 3000 | The plugin will listen on this port for requests from Drone. Be sure to also alter the Drone configuration when changing the port setting here.
DRONE_DATA_FOLDER | data | The folder to store the cloned repository. Can be changed to store the data persistent in a volume or bind mount.
