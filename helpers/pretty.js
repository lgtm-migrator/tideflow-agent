const colors = require('lodash')
console.log(colors)
/**
 * Returns a pretty logo for terminal
 */
module.exports.logo = pjson => {
  return `                                       
  _   _   _     ___ _             _     
 | |_|_|_| |___|  _| |___ _ _ _  |_|___ 
 |  _| | . | -_|  _| | . | | | |_| | . |
 |_| |_|___|___|_| |_|___|_____|_|_|___| ${pjson.version}
                                        `.red
}