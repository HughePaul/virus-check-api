

const config = require(process.argv[2] || './config/default.json');

const mkdirp = require('mkdirp');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require( 'child_process');

const stats = {
    scans: 0,
    errors: 0,
    viruses: 0,
    concurrent: 0,
    maxConcurrent: 0,
    maxDuration: 0
};

const log = (message, requestId = '-', ...args) => {
    console.log(new Date().toUTCString() + ' ' + requestId + ' ' + message, ...args);
};

const saveBodyToTempFile = (req) => new Promise((resolve, reject) => {
    const uuid = uuidv4();
    const filename = path.resolve(config.tempDirectory, uuid + '.jpg');
    const fd = fs.createWriteStream(filename, { autoClose: true });
    fd.on('error', reject)
    fd.on('close', () => resolve(filename));
    req.pipe(fd);
});

const scanFile = (filename) => new Promise((resolve, reject) => {
    const startTime = Date.now();

    const result = { status: 'PASSED' };
    const args = config.avArgs.map(arg => arg.replace('$filename', filename));

    const child = spawn(config.avCommand, args);

    const timer = setTimeout(() => {
        result.status = 'AV_TIMEOUT';
        result.duration = Date.now() - startTime;
        resolve(result);
        child.kill('SIGINT');
    }, config.timeout);

    const chunks = [];
    child.stdout.on('data', chunk => chunks.push(chunk));

    child.on('close', (code) => {
        clearTimeout(timer);
        result.duration = Date.now() - startTime;
        result.exitCode = code;

        const response = Buffer.concat(chunks).toString('ascii');

        const reMatch = new RegExp(config.virusMatch, 'm');
        const match = response.match(reMatch);
        if (match) {
            result.status = 'VIRUS_FOUND';
            result.virusName = match[1];
        }

        resolve(result);
    });

    child.on('error', reject);
});

const response = (res, data, status = 200) => {
    res.writeHead(status);
    res.write(JSON.stringify(data));
    res.end();
};

async function main() {
    const server = new http.Server()
    server.on('request', async (req, res) => {
        const { method, headers } = req;
        const requestId = headers['x-request-id'] || '-';
        if (method === 'GET') {
            response(res, {status: 'OK', stats});
        } else if (method === 'POST') {
            stats.scans++;
            stats.concurrent++;
            stats.maxConcurrent = Math.max(stats.maxConcurrent, stats.concurrent);
            let filename;
            try {
                log('Saving file to disk', requestId);
                await mkdirp(config.tempDirectory);
                filename = await saveBodyToTempFile(req);
                log('Scanning file', requestId);
                const result = await scanFile(filename);
                log('Scan complete', requestId, result);

                if (result.status === 'VIRUS_FOUND') stats.viruses++;
                stats.maxDuration = Math.max(stats.maxDuration, result.duration);

                response(res, result);
            } catch (e) {
                stats.errors++;
                log('Scan error:', requestId, filename, e);
                response(res, { status: 'SCAN_ERROR'}, 500);
            } finally {
                stats.concurrent--;
                if (filename) fs.unlink(filename, () =>
                    log('Removed file from disk', requestId));
            }
        } else {
            response(res, {status: 'METHOD_NOT_ALLOWED', method}, 405);
        }
    });

    server.listen(config.port, () =>
        log('Server listening on port ' + config.port));
}

main().catch(console.error);
