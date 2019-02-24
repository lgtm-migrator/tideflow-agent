const { spawn } = require('child_process')
const report = require('./helpers/report')

/**
 * Handles the execution of commands sent from the platform
 * 
 * @param {Object} socket Socket's io socket that requested the execution
 * @param {String} topic Original message's topic
 * @param {Object} req Original request that came fromthe platform
 */
const cmd = (socket, topic, req) => {
  return new Promise((resolve, reject) => {
  
    // Given the command to execute, get the program's name and its parameters
    // in order to pass them to child_process.spawn
    const parameters = req.command.split(' ')
    const command = parameters.shift()

    // Execute the command in a child process so that stds can be monitored
    let sp = spawn(command, parameters)

    // Report stdout
    sp.stdout.on('data', data =>
      report.progress(socket, topic, req, data.toString(), null)
    )
    
    // Report stderr
    sp.stderr.on('data', data => 
      report.progress(socket, topic, req, null, data.toString())
    )
    
    // Report Exit code
    sp.on('exit', code => {
      report.result( socket, topic, req,
        {
          stderr: code ? `EXIT CODE ${code}` : null,
          stdout: code ? null : `EXIT CODE ${code}`
        }
      )

      return code ? reject(code) : resolve()
    })
    
    // Report an exception
    sp.on('error', (error) => {
      report.exception( socket, topic, req, error.toString() )
      return reject(error)
    })
  })
}

module.exports.cmd = cmd