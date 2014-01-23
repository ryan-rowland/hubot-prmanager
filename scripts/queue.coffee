# Queue class
module.exports = Queue = () ->
  
  constructor: (@robot) ->
    @queue = []

    @robot.brain.on 'loaded', =>
      if @robot.brain.data.queue
        @queue = @robot.brain.data.queue

  remove: (name) ->
    index = @queue.indexOf(name)
    if index < 0 then return index

    @queue.splice(index, 1)
    @robot.brain.data.queue = @queue
    return index

  add: (name) ->
    index = @queue.indexOf(name)
    if index < 0 then @queue.push(name)
    @robot.brain.data.queue = @queue
    return index

  next: (exclude) ->
    name = @queue.shift()
    if name == exclude
      @queue.splice(1,0,name)
      name = @queue.shift()
    @queue.push(name)
    @robot.brain.data.queue = @queue
    return name

  list: () ->
    return @queue

  clear: () ->
    @queue = []
    @robot.brain.data.queue = @queue

