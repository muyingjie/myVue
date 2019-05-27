function ViewComp (options) {
  this._init(options)
}
ViewComp.prototype._init = function (options) {
  this._options = options
  this._initData(options.data)
  this._mount(options.el)
}
ViewComp.prototype._initData = function (data) {
  observe(data)
}
function observe (value) {
  if (!isObject(value)) return
  let ob = value.__ob__
  if (ob && ob instanceof Observer) return ob
  return new Observer(value)
}
function Observer (value) {
  this.value = value
  if (isObject(value)) {
    this.walk(value)
  }
}
Observer.prototype.walk = function (obj) {
  let keys = Object.keys(obj)
  for (let i = 0; i < keys.length; i++) {
    defineReactive(obj, keys[i])
  }
}
let curWatcher = null
function defineReactive (obj, key) {
  const dep = new Dep()
  let value = obj[key]
  let childOb = !observe(value)
  Object.defineProperty(obj, key, {
    get: function () {
      if (curWatcher) {
        dep.depend()
      }
      return value
    },
    set: function (newValue) {
      if (value === newValue) return
      value = newValue
      childOb = observe(newValue)
      dep.notify()
    }
  })
}
function Dep () {
  this.subs = []
}
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}
Dep.prototype.depend = function () {
  // 并没有直接将curWatcher加入subs中，而是将watcher和当前dep对象关联了起来，在watcher对象里面调用dep的addSub收集依赖
  if (curWatcher) {
    curWatcher.addDep(this)
  }
}
Dep.prototype.notify = function () {
  for (let i = 0, l = this.subs.length; i < l; i++) {
    this.subs[i].update()
  }
}
function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}
function Watcher (vm, fn, cb, options) {
  this.vm = vm
  this.getter = fn
  this.cb = cb
  this.value = undefined
  this.deps = []

  this.get()
}
Watcher.prototype.addDep = function (dep) {
  if (!this.deps.has(dep)) {
    this.deps.push(dep)
    dep.addSub(this)
  }
}
Watcher.prototype.update = function () {
  this.run()
}
Watcher.prototype.run = function () {
  const value = this.get()
  if (value !== this.value) {
    let oldValue = this.value
    this.value = value
    this.cb.call(this.vm, value, oldValue)
  }
}
Watcher.prototype.get = function () {
  curWatcher = this
  let value = this.getter.call(this.vm)
  this.cleanupDeps()
  return value
}
Watcher.prototype.cleanupDeps = function () {
  this.deps = []
}
ViewComp.prototype._mount = function (el) {
  el = document.querySelector(el)
  const options = this._options
  if (!options.render) {
    // 可能从ViewComp单文件、template属性等里面取，最终都会转为render方法
    let template = options.template
    // 编译
    const { render } = compileToFunctions(template)
    options.render = render
  }
  // 执行真正的挂载过程，即将虚拟DOM转换为真实DOM
  return mountComponent(vm, el)
}
function compileToFunctions () {
  return {
    render: function () {
    }
  }
}
function mountComponent (vm, el) {
  let updateComponent = () => {
    vm._update(vm._render())
  }
  new Watcher(vm, updateComponent, noop)
  return vm
}
ViewComp.prototype._render = function () {
  const vm = this
  const render = vm._options.render
  let vnode = render.call(vm, vm.$createElement)
  return vnode
}
ViewComp.prototype.$createElement = function () {}
ViewComp.prototype._update = function (vnode) {
  const vm = this
  const prevEl = vm.$el
  const prevVnode = vm._node

  vm._vnode = vnode
  if (!prevVnode) {
    vm.$el = vm.__patch__(vm.$el, vnode)
  } else {
    vm.$el = vm.__patch__(prevVnode, vnode)
  }
}
ViewComp.prototype.$watch = function (expOrFn, cb, options) {
  const vm = this
  options = options || {}
  const watcher = new Watcher(vm, expOrFn, cb, options)
  if (options.immediate) {
    cb.call(vm, watcher.value)
  }
  return function unwatchFn () {
    watcher.teardown()
  }
}
