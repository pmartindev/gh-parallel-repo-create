import { parentPort, workerData } from 'worker_threads';
import { Octokit } from '@octokit/rest';
import { createRepoApi } from './api-request';

interface WorkerData {
    org: string;
    authToken: string;
    endpoint: string;
}

const { org, authToken, endpoint }: WorkerData = workerData;
const octokit: Octokit = new Octokit({
    auth: authToken,
    baseUrl: endpoint
});

createRepoApi(octokit, org).then((result: string) => {
    if (parentPort) {
        parentPort.postMessage(result);
    }
}).catch((error: Error) => {
    console.error(error);
    process.exit(1);
});