import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
const yargs = require('yargs')

const collectResults = async() => {
    dotenv.config();
    const { endpoint, authToken } = acceptCommandLineArgs();
    const octokit: Octokit = new Octokit({
        auth: authToken,
        baseUrl: endpoint
    });
    const promises: Promise<string>[] = Array.from({ length: 100 }, () => runApiRequest(octokit));
    return Promise.all(promises);
};

const run = async () => {
    console.log('Collecting results...');
    const results: string[] = await collectResults();
    console.log(results);
    console.log('Done');
  };

async function runApiRequest(octokit: Octokit) {
    const result: string = (await octokit.users.getAuthenticated()).data.login;
    return result;
}

export function acceptCommandLineArgs(): { endpoint: string, authToken: string } {
    const argv = yargs.default(process.argv.slice(2))
        .env('GITHUB')
        .option('endpoint', {
            alias: 'e',
            env: 'GITHUB_ENDPOINT',
            description: 'The api endpoint of the github instance (ex. api.github.com)',
            type: 'string',
            demandOption: true,
        })
        .option('authToken', {
            alias: 't',
            env: 'GITHUB_AUTH_TOKEN',
            description: 'The personal access token for the GHES Migration API.',
            type: 'string',
            demandOption: true,
        }).argv;
    return { endpoint: argv.endpoint, authToken: argv.authToken };
}

// The main entrypoint for the application
run();