const git = require('simple-git/promise');
const fs = require('fs')
const os = require('os')
const path = require('path')
const spawn = require('cross-spawn')
const report = require('../helpers/report')

const genTmpFolder = (subfix) => {
  const tmpPath = `${os.tmpdir}${path.sep}${subfix || new Date().getTime()}`
  
  if (fs.existsSync(tmpPath)) {
    return tmpPath
  }
  
  fs.mkdirSync(tmpPath)
  return tmpPath
}

const push = (socket, topic, req) => {
  console.log({req})
  const triggerService = req.triggerService
  const webhook = req.webhook
  const repo = webhook.repository.full_name
  const tmpPath = genTmpFolder(req.execution)

  report.progress(socket, req, `Clonning ${repo}`, null)
  report.progress(socket, req, `Temporal path ${tmpPath}`, null)

  // Clone repository
  git()
    .clone(`https://tideflow:${triggerService.config.secret}@github.com/${repo}`, tmpPath)
    .then(result => {
      delete req.webhook
      report.result( socket, req,
        {
          stderr: null,
          stdout: 'Clone finished'
        }
      )
    })
    .catch(err => {
      report.exception( socket, req, err.toString() )
    });
}

module.exports.push = push

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
    console.log('all promises done')
    report.result(socket, req,
      {
        stdout: 'Clone finished'
      }
    )
  }
  catch (ex) {
    report.exception(socket, req, ex)
  }
}

module.exports.test_cmd = test_cmd

