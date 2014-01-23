#Fs   = require 'fs'
#Path = require 'path'

module.exports = (robot) ->
  robot.loadFile __dirname + '/scripts/main.coffee'
  #path = Path.resolve __dirname, 'scripts'
  #Fs.exists path, (exists) ->
    #if exists
      #robot.loadFile path, file for file in Fs.readdirSync(path)
