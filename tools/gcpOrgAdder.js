var utils = require('./utils')
var program = require('commander');
var Q = require('q');
var _ = require('lodash');
program
    .option('-p, --path <path>', 'service account key path for google cloud account')
    .option('-i, --id <id>', 'API key ID for Dome9')
    .option('-c, --compute <compute>', 'compute?')
    .option('-s, --secret <secret>', 'API key secret for Dome9')
    .parse(process.argv);

var mustService = 'cloudresourcemanager.googleapis.com';

const services = [
    'iam.googleapis.com',
    'cloudkms.googleapis.com'
];

console.log(program.path)
var google = require('googleapis');
var cloudresourcemanager = google.cloudresourcemanager('v1');
let serviceusage = google.servicemanagement('v1')
// First I want to read the file
var key = require(program.path);
var jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/service.management'],
    null
);
if (program.compute === 'true' || !program.compute) program.compute = true;
else if (program.compute === 'false') program.compute = false;
else if (program.compute && program.compute !== 'true' && program.compute !== 'false') throw 'error: invalid compute param';
var auth = {
    username: program.id,
    password: program.secret
};
var d9Url = `https://api.dome9.com/v2/GoogleCloudAccount?skipComputeValidation=${!program.compute}`;

jwtClient.authorize(function (err, tokens) {
    if (err) {
        console.log(err);
        process.exit(1)
    }
    var request = {
        // TODO: Change placeholders below to appropriate parameter values for the 'list' method:
        // Auth client
        auth: jwtClient
    };

    var mainRequestForService = {
        // TODO: Change placeholders below to appropriate parameter values for the 'list' method:
        // Auth client
        auth: jwtClient
    };
    // Make an authorized request to list Drive files.
    var recur = async function (err, result) {
        if (err) {
            console.log(err);
        } else {
            // console.log(result);
            var counter = 0;
            var withFailure = false;
            let readyToOnboardList = [];
            console.log(`start to enable ${result.projects.length} GCP accounts`);
            for (let i = 0; i < result.projects.length; i++) {
                console.log(`start to enable ${i + 1} / ${result.projects.length}.`);
                let acc = result.projects[i];
                let promises = [];
                let requestForService = {
                    // TODO: Change placeholders below to appropriate parameter values for the 'list' method:
                    // Auth client
                    auth: jwtClient
                };

                try {
                    requestForService.serviceName = 'cloudresourcemanager.googleapis.com';
                    requestForService.consumerId = `project:${acc.projectId}`;
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'iam.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'cloudkms.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'compute.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'container.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'bigquery-json.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'admin.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'bigtableadmin.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    // console.log(`project:${acc.projectId} - ${requestForService.serviceName} enabled`);
                    requestForService.serviceName = 'cloudfunctions.googleapis.com';
                    promises.push(utils.enableService(_.cloneDeep(requestForService)));

                    await Q.all(promises);
                    console.log(`enabled all apis successfully for project: ${acc.projectId}`);
                    readyToOnboardList.push(acc);
                }

                catch (e) {
                    if (e && e.message) {
                        console.error(`project:${acc.projectId} failed`, e.message)
                    }
                }
                finally {
                    if (i === result.projects.length - 1) {
                        if (!readyToOnboardList.length) {
                            console.log(`0 accounts were valid to onboard`);
                            process.exit(1)

                        }
                        console.log('waiting 20 sec to onboard');
                        await Q.delay(20 * 1000);
                        //first try
                        let retryAccounts = [];
                        console.log(`start to do DOME9 on-boarding ${readyToOnboardList.length} GCP accounts`);
                        _.forEach(readyToOnboardList, function (account, idx) {
                            var currentKey = utils.clone(key);
                            currentKey.project_id = account.projectId;
                            console.log('adding project: ', currentKey.project_id);
                            let options = {
                                url: d9Url,
                                method: 'POST',
                                body: {
                                    name: currentKey.project_id,
                                    serviceAccountCredentials: currentKey
                                },
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36',
                                    'Content-Type': 'application/json; charset=UTF-8',
                                    'Accept': 'application/json, text/plain, */*'
                                },
                                json: true
                            };
                            utils.simpleReq(options, auth).then(function (res) {
                                counter++;
                                console.log('Project added successfully', res);
                            })
                                .catch(function (err) {
                                    retryAccounts.push(account);
                                    counter++;
                                    withFailure = true;
                                    console.error(err.error);
                                })
                                .finally(function () {
                                    console.log(`finished DOME9 on-boarding ${idx+1} / ${readyToOnboardList.length}`);
                                    if (counter == readyToOnboardList.length && !withFailure) {
                                        process.exit(0)
                                    }
                                    else if (counter == readyToOnboardList.length && withFailure) {
                                        retry();
                                    }
                                })
                        });

                        //second try
                        function retry() {
                            console.log('retry on-boarding');
                            counter = 0;
                            _.forEach(retryAccounts, function (account) {
                                var currentKey = utils.clone(key);
                                currentKey.project_id = account.projectId;
                                console.log('adding project: ', currentKey.project_id);
                                let options = {
                                    url: d9Url,
                                    method: 'POST',
                                    body: {
                                        name: currentKey.project_id,
                                        serviceAccountCredentials: currentKey
                                    },
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36',
                                        'Content-Type': 'application/json; charset=UTF-8',
                                        'Accept': 'application/json, text/plain, */*'
                                    },
                                    json: true
                                };
                                utils.simpleReq(options, auth).then(function (res) {
                                    counter++;
                                    console.log('Project added successfully', res);
                                })
                                    .catch(function (err) {
                                        counter++;
                                        withFailure = true;
                                        console.error(err.error);
                                    })
                                    .finally(function () {
                                        if (counter == retryAccounts.length && !withFailure) {
                                            process.exit(0)
                                        }
                                        else if (counter == retryAccounts.length && withFailure) {
                                            process.exit(1)
                                        }
                                    })
                            })
                        }

                    }
                }
            }

            if (result.nextPageToken) {
                request.pageToken = result.nextPageToken;
                cloudresourcemanager.projects.list(request, recur);
            }
        }
    };


    mainRequestForService.serviceName = 'cloudresourcemanager.googleapis.com';
    mainRequestForService.consumerId = `project:${key.project_id}`;


    serviceusage.services.enable(mainRequestForService, function (res) {
        if (res && res.errors && res.errors.length) {
            console.error(`on-boarding failed project:${key.project_id}`, res.errors[0].message);
            process.exit(1);
        }
        else cloudresourcemanager.projects.list(request, recur);
    });
});
