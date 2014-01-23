# Includes
url = require('url')
querystring = require('querystring')

Queue = require('./queue.coffee')
PR_Manager = require('./pr_manager.coffee')

# Exports
module.exports = (robot) ->
  queue = new Queue robot
  prManager = new PR_Manager robot, queue

  console.log("Is this really working?")
  prManager.updateHooks()
  setInterval () ->
    prManager.updateHooks()
  , 60000

  robot.respond /q add ?(.*)/i, (msg) ->
    target = msg.match[1].toLowerCase()
    exists = queue.add(target)
    
    if exists < 0
      msg.send "Added #{target} to the rotation"
    else
      msg.send "#{target} is already on the list"

  robot.respond /q remove ?(.*)/i, (msg) ->
    target = msg.match[1].toLowerCase()
    exists = queue.remove(target)

    if exists < 0
      msg.send "#{target} wasn't on the list"
    else
      msg.send "I removed #{target} from the queue"

  robot.respond /q show/i, (msg) ->
    msg.send queue.list().join(', ') || "The queue is empty"

  robot.respond /q clear/i, (msg) ->
    queue.clear()
    msg.send "Cleared the queue"

  robot.respond /pr set ?([^\s]+) ?([^\s]+) ?([^\s]+)/, (msg) ->
    msg.send prManager.setParam msg.match[1], msg.match[2], msg.match[3]

  robot.respond /pr get ?([^\s]+) ?([^\s]+)/, (msg) ->
    msg.send msg.match[1] + ' ' + msg.match[2] + ' = ' + prManager.getParam msg.match[1], msg.match[2]

  robot.respond /pr describe ?([^\s]+)/, (msg) ->
    msg.send msg.match[1] + ' = ' + JSON.stringify prManager.getRequest msg.match[1]

  robot.respond /pr delete ?([^\s]+)/, (msg) ->
    prManager.deleteRequest msg.match[1]
    msg.send 'Deleted ' + msg.match[1]

  robot.respond /pr list/i, (msg) ->
    list = prManager.list()
    response = 'Open Pull Requests:\n'
    response += "#{request.url} | Assigned to: #{request.assignee}\n" for request in list
    msg.send if list.length > 0 then response else 'There are no open pull requests!'

  robot.respond /show repos/i, (msg) ->

  robot.router.post "/hubot/gh-pull-requests", (req, res) ->
    data = req.body
    query = querystring.parse(url.parse(req.url).query)
    repo = data.repository.name

    user = {}
    user.room = query.room if query.room
    user.type = query.type if query.type

    request = {}
    request.id = data.repository.name + '/' + data.number
    request.url = data.pull_request.html_url
    request.repo = data.repository.name
    request.title = data.pull_request.title
    request.branch = data.pull_request.head.ref
    request.merged = data.pull_request.merged
    request.number = data.number
    request.assignee = data.pull_request.assignee
    request.initiator = data.pull_request.user.login

    res.end

    if data.action == 'opened'
      request = prManager.open(request)
      robot.send user, "New PR: #{request.url} | From branch '#{request.branch}' | Description: '#{request.title}' | Opened by #{request.initiator} | Assigned to #{request.assignee}"
    else if data.action == 'reopened'
      request = prManager.reopen(request)
      robot.send user, "Re-opened PR: #{request.url} | From branch '#{request.branch}' | Re-opened by #{data.sender.login} | Assigned to #{request.assignee}"
    else if data.action == 'synchronize'
      #prManager.getCommitComment repo, request.number, (comment) ->
      robot.send user, "Updated PR: #{request.url}"
    else if data.action == 'closed'
      request = prManager.close(request)
      if request.merged
        robot.send user, "Merged PR: #{request.url} | Merged by #{data.sender.login}"
      else
        prManager.getIssueComment repo, request.number, (comment) ->
          robot.send user, "Rejected PR: #{request.url} | Closed by #{data.sender.login} | Reason: #{comment}"

