const git = require('simple-git/promise');
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const spawn = require('cross-spawn')
const report = require('../helpers/report')

const { createAppAuth } = require('@octokit/auth-app');

/**
 * 
 * @param {Object} context Original socket request content with:
 * 
 * {
 *  flow: string,
 *  execution: string,
 *  log: string,
 *  step: string,
 *  triggerService: {
 *    _id: string,
 *    type: string,
 *    title: string,
 *    description: string,
 *    user: string,
 *    config: {},
 *    createdAt: date,
 *    updatedAt: date,
 *    details: {}
 *  },
 *  webhook: {} // Original webhook from Github
 * }
 */
const appAuth = (context) => {
  const { pem, secret, appId, clientId } = context.triggerService.config
  const { id } = context.webhook.installation

  return createAppAuth({
    id: appId,
    privateKey: pem,
    clientId: clientId,
    clientSecret: secret,
    installationId: id
  })({type: 'installation'})
}

function cloneUrlWithToken(cloneUrl, token) {
  return cloneUrl.replace('https://', `https://x-access-token:${token}@`);
}

const genTmpFolder = (subfix) => {
  const tmpPath = `${os.tmpdir}${path.sep}${subfix || new Date().getTime()}`
  
  if (fs.existsSync(tmpPath)) {
    return tmpPath
  }
  
  fs.mkdirSync(tmpPath)
  return tmpPath
}

const push = async (socket, topic, req) => {
  const triggerService = req.triggerService
  const webhook = req.webhook
  const repo = webhook.repository.full_name
  const tmpPath = genTmpFolder(req.execution)

  const sha = webhook.head_commit.id

  report.progress(socket, req, `Clonning ${repo}`, null)
  report.progress(socket, req, `SHA ${sha}`, null)
  report.progress(socket, req, `Temporal path ${tmpPath}`, null)

  // Clone repository
  try {
    const auth = await appAuth(req)
    let cloneUrl = cloneUrlWithToken(`https://github.com/${repo}`, auth.token)
    await git().clone(cloneUrl, tmpPath)
    await git(tmpPath).checkout(sha)
    delete req.webhook
    report.result( socket, req,
      {
        stderr: null,
        stdout: 'Clone finished'
      }
    )
  }
  catch (ex) {
    report.exception( socket, req, ex.toString() )
  }
}

module.exports.push = push

const pullRequest = async (socket, topic, req) => {
  const triggerService = req.triggerService
  const webhook = req.webhook
  const repo = webhook.repository.full_name
  const tmpPath = genTmpFolder(req.execution)

  const sha = webhook.pullRequest.head.sha

  report.progress(socket, req, `Clonning ${repo}`, null)
  report.progress(socket, req, `SHA ${sha}`, null)
  report.progress(socket, req, `Temporal path ${tmpPath}`, null)

  // Clone repository
  try {
    const auth = await appAuth(req)
    let cloneUrl = cloneUrlWithToken(`https://github.com/${repo}`, auth.token)
    await git().clone(cloneUrl, tmpPath)
    await git(tmpPath).checkout(sha)
    delete req.webhook
    report.result( socket, req,
      {
        stderr: null,
        stdout: 'Clone finished'
      }
    )
  }
  catch (ex) {
    report.exception( socket, req, ex.toString() )
  }
}

module.exports.pullRequest = pullRequest

const checksuite = async (socket, topic, req) => {
  const triggerService = req.triggerService
  const webhook = req.webhook
  const repo = webhook.repository.full_name
  const tmpPath = genTmpFolder(req.execution)

  const sha = webhook.check_suite.head_sha

  report.progress(socket, req, `Clonning ${repo}`, null)
  report.progress(socket, req, `SHA ${sha}`, null)
  report.progress(socket, req, `Temporal path ${tmpPath}`, null)

  // Clone repository
  try {
    const auth = await appAuth(req)
    let cloneUrl = cloneUrlWithToken(`https://github.com/${repo}`, auth.token)
    await git().clone(cloneUrl, tmpPath)
    await git(tmpPath).checkout(sha)
    delete req.webhook
    report.result( socket, req,
      {
        stderr: null,
        stdout: 'Clone finished'
      }
    )
  }
  catch (ex) {
    report.exception( socket, req, ex.toString() )
  }
}

module.exports.checksuite = checksuite

const executionFinished = async (socket, topic, req) => {
  const tmpPath = genTmpFolder(req.execution)
  fs.removeSync(tmpPath)
}
module.exports.executionFinished = executionFinished

const test_cmd = async (socket, topic, req) => {
  const commands = req.cmd.split('\n')
  const webhook = req.webhook
  const currentStep = req.currentStep
  
  const cwd = genTmpFolder(req.execution)

  let erroed = false
  let error = ''

  const processCommands = commands.map(c => {
    return new Promise((resolve, reject) => {

      let command = c.trim()

      // ignore empty commands
      if (command === '') return resolve()

      if (erroed) return reject()

      report.progress(socket, req, command, null)

      try {
        let sp = spawn(command, { cwd, stdio: ['inherit', 'pipe', 'pipe'] })

        // Report stdout
        sp.stdout.on('data', data => report.progress(socket, req, data.toString(), null))
        
        // Report stderr
        sp.stderr.on('data', data => report.progress(socket, req, null, data.toString()))
        
        sp.on('error', error => {
          return reject(error)
        })
        
        // Report Exit code
        sp.on('exit', code => {
          console.log(`exit ${code}`)
          if (code) {
            erroed = true
            error = `EXIT CODE ${code}`
            return reject(error)
          }
          return resolve()
        })
      }
      catch (ex) {
        return reject(ex)
      }
      
    })
  })

  try {
    await Promise.all(processCommands)
    report.result(socket, req,
      {
        stdout: 'Execution finished'
      }
    )
  }
  catch (ex) {
    report.exception(socket, req, ex)
  }
}

module.exports.test_cmd = test_cmd
module.exports.run_cmd = test_cmd
