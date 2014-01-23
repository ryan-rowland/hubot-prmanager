# Pull Request Manager Class
module.exports =  PR_Manager = () ->
  constructor: (@robot, @queue) ->
    @gh = require('githubot')(@robot)
    @prs = {}

    @robot.brain.on 'loaded', =>
      if @robot.brain.data.prs
        @prs = @robot.brain.data.prs

  open: (request) ->
    request.assignee ?= @queue.next(request.initiator)
    request.open = true

    @prs[request.id] = request
    @robot.brain.data.prs = @prs

    return request

  reopen: (request) ->
    if @prs[request.id]
      @prs[request.id].open = true
      request.assignee = @prs[request.id].assignee
      @robot.brain.data.prs = @prs
      return request
    else
      return @open request

  close: (request) ->
    if @prs[request.id] then @prs[request.id].open = false
    @robot.brain.data.prs = @prs
    return request

  setParam: (id, key, value) ->
    if @prs[id]
      @prs[id][key] = value
      @robot.brain.data.prs = @prs
      return 'Set ' + key + ' of ' + id + ' to ' + value
    else
      return 'Couldn\'t find ' + id

  getParam: (id, key) ->
    if @prs[id]
      return @prs[id][key]
    else
      return 'Couldn\'t find ' + id

  deleteRequest: (id) ->
    if @prs[id]
      delete @prs[id]
      @robot.brain.data.prs = @prs

  getRequest: (id) ->
    if @prs[id]
      output = []
      for key of @prs[id]
        output.push key + '=' + @prs[id][key]
      return output
    else
      return 'Couldn\'t find ' + id

  getHooks: (repoName, cb) ->
    org = process.env.HUBOT_GITHUB_ORG || 'sony-magic'
    baseUrl = process.env.HUBOT_GITHUB_API || 'https://api.github.com'
    hookUrl = "#{baseUrl}/repos/#{org}/#{repoName}/hooks"
    @gh.get hookUrl, (hooks) ->
      cb(hooks, repoName)

  setHook: (repoName, cb) ->
    org = process.env.HUBOT_GITHUB_ORG || 'sony-magic'
    baseUrl = process.env.HUBOT_GITHUB_API || 'https://api.github.com'
    hookUrl = "#{baseUrl}/repos/#{org}/#{repoName}/hooks"

    hookData = {
      "name" : "web",
      "active" : true,
      "events" : [ "pull_request" ],
      "config" : {
        "url" : "http://184.169.138.183:8081/hubot/gh-pull-requests?room=%23pullrequests",
        "content_type" : "json"
      }
    }

    @gh.post hookUrl, hookData, (hook) ->
      cb(hook)

  updateHooks: () ->
    _this = this
    this.getRepos (repos) ->
      list = ''
      for repo in repos
        _this.getHooks repo.name, (hooks, repoName) ->
          isHooked = false
          for hook in hooks
            if hook.config.url && hook.config.url.indexOf 'gh-pull-requests' != -1
              isHooked = true
          if !isHooked then _this.setHook repoName, (response) ->
            _this.robot.send { 'room' : '#pullrequests' }, 'Set hook on ' + repoName
            _this.robot.send { 'room' : '#chat' }, 'Set hook on ' + repoName
            console.log 'Set hook on ' + repoName
    
  getRepos: (cb) ->
    org = process.env.HUBOT_GITHUB_ORG || 'sony-magic'
    baseUrl = process.env.HUBOT_GITHUB_API || 'https://api.github.com'
    reposUrl = "#{baseUrl}/orgs/sony-magic/repos?type=private"
    @gh.get reposUrl, (repos) ->
      cb(repos)

  list: () ->
    openRequests = []
    console.log(@robot.brain.data.prs, @prs)
    for req of @prs when @prs[req].open == true
      openRequests.push(@prs[req])

    return openRequests

  getIssueComment: (repo, issueID, cb) ->
    org = process.env.HUBOT_GITHUB_ORG || 'sony-magic'
    baseUrl = process.env.HUBOT_GITHUB_API || 'https://api.github.com'
    commentUrl = "#{baseUrl}/repos/#{org}/#{repo}/issues/#{issueID}/comments?sort=created&direction=desc"

    @gh.get commentUrl, (comments) ->
      reason = if comments && comments[0] then comments[0].body else 'Unspecified'
      cb(reason)

