
# Virus scan POC

## Installing and running:

```
npm install
node .
```

### running with a specific config

```
node . ./config/clamav.json
```

## Requests

All GET requests will return server status

All POST reqeusts will perform a virus scan

Accepts a X-Request-ID header to add to log lines

Example curl request and responses:

### Clean file:
```
curl --data-binary @../../../Downloads/photos/f1_pass.jpg localhost:3000
{"status":"PASSED","duration":5022,"exitCode":0}
```

### Virus file
```
curl --data-binary @../../../Downloads/photos/f1_virus.jpg localhost:3000
{"status":"VIRUS_FOUND","duration":25742,"exitCode":1,"virusName":"Win.Trojan.Hide-2"}
```

### Scan timeout
```
curl --data-binary @../../../Downloads/photos/f1_pass.jpg localhost:3000
{"status":"AV_TIMEOUT","duration":30031}
```
