docker build . -t ghcr.io/fantomitechno/celeste-mirror:latest -t ghcr.io/fantomitechno/celeste-mirror:$1
docker push ghcr.io/fantomitechno/celeste-mirror:latest
docker push ghcr.io/fantomitechno/celeste-mirror:$1