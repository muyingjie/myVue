window.VueObserver = (function(exports) {
  let LOCKED = true
  const EMPTY_OBJ = Object.freeze({})
  const extend = (a, b) => {
    for (const key in b) {
      a[key] = b[key]
    }
    return a
  }
  const hasOwn = (val, key) => Object.prototype.hasOwnProperty.call(val, key)
  const isFunction = val => typeof val === "function"
  const isSymbol = val => typeof val === "symbol"
  const isObject = val => val !== null && typeof val === "object"
  const toTypeString = value => Object.prototype.toString.call(value)
  const builtInSymbols = new Set(
    Object.getOwnPropertyNames(Symbol)
      .map(key => Symbol[key])
      .filter(isSymbol)
  )

  function createGetter(isReadonly) {
    return function get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver)
      if (isSymbol(key) && builtInSymbols.has(key)) {
        return res
      }
      if (isRef(res)) {
        return res.value // ref的 "getter" 也会调用 "track"
      }
      track(target, "get" /* GET */, key)
      if (!isObject(res)) {
        return res
      }
      // need to lazy access readonly and reactive here to avoid circular dependency
      return isReadonly ? readonly(res) : reactive(res)
    }
  }
  function createSetter(isReadonly) {
    return function set(target, key, value, receiver) {
      if (isReadonly && LOCKED) {
        console.warn(
          `Set key "${String(key)}" failed: target is readonly.`,
          target
        )
        return true
      }

      value = toRaw(value)
      const hadKey = hasOwn(target, key)
      const oldValue = target[key]

      if (isRef(oldValue) && !isRef(value)) {
        // ref 的 "setter" 也会调用 "trigger"
        oldValue.value = value
        return true
      }

      const result = Reflect.set(target, key, value, receiver)
      if (target === toRaw(receiver)) {
        // 如果target位于original的原型链中，则不要触发
        const extraInfo = { oldValue, newValue: value }
        if (!hadKey) {
          trigger(target, "add" /* ADD */, key, extraInfo)
        } else if (value !== oldValue) {
          trigger(target, "set" /* SET */, key, extraInfo)
        }
      }
      return result
    }
  }
  function createDelete(isReadonly) {
    return function deleteProperty(target, key) {
      if (isReadonly && LOCKED) {
        console.warn(
          `Delete key "${String(key)}" failed: target is readonly.`,
          target
        )
        return true
      }

      const hadKey = hasOwn(target, key)
      const oldValue = target[key]
      const result = Reflect.deleteProperty(target, key)
      if (result && hadKey) {
        trigger(target, "delete" /* DELETE */, key, { oldValue })
      }
      return result
    }
  }
  function has(target, key) {
    const result = Reflect.has(target, key)
    track(target, "has" /* HAS */, key)
    return result
  }
  function ownKeys(target) {
    track(target, "iterate" /* ITERATE */)
    return Reflect.ownKeys(target)
  }

  const mutableHandlers = {
    get: createGetter(false),
    set: createSetter(false),
    deleteProperty: createDelete(false),
    has,
    ownKeys,
  }
  const readonlyHandlers = {
    get: createGetter(true),
    set: createSetter(true),
    deleteProperty: createDelete(true),
    has,
    ownKeys,
  }

  const toReactive = value => (isObject(value) ? reactive(value) : value)
  const toReadonly = value => (isObject(value) ? readonly(value) : value)

  function get$1(target, key, wrap) {
    target = toRaw(target)
    key = toRaw(key)
    const proto = Reflect.getPrototypeOf(target)
    track(target, "get" /* GET */, key)
    const res = proto.get.call(target, key)
    return wrap(res)
  }
  function has$1(key) {
    const target = toRaw(this)
    key = toRaw(key)
    const proto = Reflect.getPrototypeOf(target)
    track(target, "has" /* HAS */, key)
    return proto.has.call(target, key)
  }
  function size$1(target) {
    target = toRaw(target)
    const proto = Reflect.getPrototypeOf(target)
    track(target, "iterate" /* ITERATE */)
    return Reflect.get(proto, "size", target)
  }
  function add$1(value) {
    value = toRaw(value)
    const target = toRaw(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, value)
    const result = proto.add.call(target, value)
    if (!hadKey) {
      trigger(target, "add" /* ADD */, value, { value })
    }
    return result
  }
  function set$1(key, value) {
    value = toRaw(value)
    const target = toRaw(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get.call(target, key)
    const result = proto.set.call(target, key, value)
    if (value !== oldValue) {
      const extraInfo = { oldValue, newValue: value }
      if (!hadKey) {
        trigger(target, "add" /* ADD */, key, extraInfo)
      } else {
        trigger(target, "set" /* SET */, key, extraInfo)
      }
    }
    return result
  }
  function deleteEntry$1(key) {
    const target = toRaw(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadKey = proto.has.call(target, key)
    const oldValue = proto.get ? proto.get.call(target, key) : undefined
    // forward the operation before queueing reactions
    const result = proto.delete.call(target, key)
    if (hadKey) {
      trigger(target, "delete" /* DELETE */, key, { oldValue })
    }
    return result
  }
  function clear$1() {
    const target = toRaw(this)
    const proto = Reflect.getPrototypeOf(this)
    const hadItems = target.size !== 0
    const oldTarget = target instanceof Map ? new Map(target) : new Set(target)
    // forward the operation before queueing reactions
    const result = proto.clear.call(target)
    if (hadItems) {
      trigger(target, "clear" /* CLEAR */, void 0, { oldTarget })
    }
    return result
  }

  function createForEach(isReadonly) {
    return function forEach(callback, thisArg) {
      const observed = this
      const target = toRaw(observed)
      const proto = Reflect.getPrototypeOf(target)
      const wrap = isReadonly ? toReadonly : toReactive
      track(target, "iterate" /* ITERATE */)
      // important: create sure the callback is
      // 1. invoked with the reactive map as `this` and 3rd arg
      // 2. the value received should be a corresponding reactive/readonly.
      function wrappedCallback(value, key) {
        return callback.call(observed, wrap(value), wrap(key), observed)
      }
      return proto.forEach.call(target, wrappedCallback, thisArg)
    }
  }
  function createIterableMethod(method, isReadonly) {
    return function(...args) {
      const target = toRaw(this)
      const proto = Reflect.getPrototypeOf(target)
      const isPair =
        method === "entries" ||
        (method === Symbol.iterator && target instanceof Map)
      const innerIterator = proto[method].apply(target, args)
      const wrap = isReadonly ? toReadonly : toReactive
      track(target, "iterate" /* ITERATE */)

      // 返回一个包装的迭代器，该迭代器返回从实际迭代器返回值的观察版本
      return {
        next() {
          const { value, done } = innerIterator.next()
          return done
            ? { value, done }
            : {
                value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                done,
              }
        },
        [Symbol.iterator]() {
          return this
        },
      }
    }
  }
  function createReadonlyMethod(method, type) {
    return function(...args) {
      if (LOCKED) {
        const key = args[0] ? `on key "${args[0]}" ` : ``
        console.warn(
          `${type} operation ${key}failed: target is readonly.`,
          toRaw(this)
        )
        return type === "delete" /* DELETE */ ? false : this
      } else {
        return method.apply(this, args)
      }
    }
  }

  const mutableInstrumentations = {
    get size() {
      return size$1(this)
    },
    get(key) {
      return get$1(this, key, toReactive)
    },
    has: has$1,
    add: add$1,
    set: set$1,
    delete: deleteEntry$1,
    clear: clear$1,
    forEach: createForEach(false),
  }
  const readonlyInstrumentations = {
    get size() {
      return size$1(this)
    },
    get(key) {
      return get$1(this, key, toReadonly)
    },
    has: has$1,
    add: createReadonlyMethod(add$1, "add" /* ADD */),
    set: createReadonlyMethod(set$1, "set" /* SET */),
    delete: createReadonlyMethod(deleteEntry$1, "delete" /* DELETE */),
    clear: createReadonlyMethod(clear$1, "clear" /* CLEAR */),
    forEach: createForEach(true),
  }
  const iteratorMethods = ["keys", "values", "entries", Symbol.iterator]
  iteratorMethods.forEach(method => {
    mutableInstrumentations[method] = createIterableMethod(method, false)
    readonlyInstrumentations[method] = createIterableMethod(method, true)
  })

  const mutableCollectionHandlers = {
    get: function getInstrumented(target, key, receiver) {
      target =
        hasOwn(mutableInstrumentations, key) && key in target
          ? mutableInstrumentations
          : target
      return Reflect.get(target, key, receiver)
    },
  }
  const readonlyCollectionHandlers = {
    get: function getInstrumented(target, key, receiver) {
      target =
        hasOwn(readonlyInstrumentations, key) && key in target
          ? readonlyInstrumentations
          : target
      return Reflect.get(target, key, receiver)
    },
  }

  // WeakMaps that store {target -> key => deps}.
  const targetMap = new WeakMap()

  // WeakMaps that store {raw <-> observed} pairs.
  const rawToReactive = new WeakMap()
  const reactiveToRaw = new WeakMap()
  const rawToReadonly = new WeakMap()
  const readonlyToRaw = new WeakMap()

  // 标记为只读或非反应性值的弱引用（用户传入），在创建observable时使用.
  const readonlyValues = new WeakSet()
  const nonReactiveValues = new WeakSet()

  const collectionTypes = new Set([Set, Map, WeakMap, WeakSet])
  const observableValueRE = /^\[object (?:Object|Array|Map|Set|WeakMap|WeakSet)\]$/
  const canObserve = value => {
    return (
      !value._isVue &&
      !value._isVNode &&
      observableValueRE.test(toTypeString(value)) &&
      !nonReactiveValues.has(value)
    )
  }

  function reactive(target) {
    if (readonlyToRaw.has(target)) {
      // 如果只读引用中已包含，则返回只读版本.
      return target
    }

    if (readonlyValues.has(target)) {
      // 目标被用户显式标记为只读
      return readonly(target)
    }

    return createReactiveObject(
      target,
      rawToReactive,
      reactiveToRaw,
      mutableHandlers,
      mutableCollectionHandlers
    )
  }

  function readonly(target) {
    if (reactiveToRaw.has(target)) {
      // value是一个可变的可观察值，检索其原始值并返回只读版本.
      target = reactiveToRaw.get(target)
    }

    return createReactiveObject(
      target,
      rawToReadonly,
      readonlyToRaw,
      readonlyHandlers,
      readonlyCollectionHandlers
    )
  }

  function createReactiveObject(
    target,
    toProxy,
    toRaw,
    baseHandlers,
    collectionHandlers
  ) {
    if (!isObject(target)) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
      return target
    }

    let observed = toProxy.get(target)
    if (observed !== void 0) {
      return observed
    }

    if (toRaw.has(target)) {
      return target
    }

    if (!canObserve(target)) {
      return target
    }

    const handlers = collectionTypes.has(target.constructor)
      ? collectionHandlers
      : baseHandlers
    observed = new Proxy(target, handlers)
    toProxy.set(target, observed)
    toRaw.set(observed, target)
    if (!targetMap.has(target)) {
      targetMap.set(target, new Map())
    }
    return observed
  }

  function toRaw(observed) {
    return (
      reactiveToRaw.get(observed) || readonlyToRaw.get(observed) || observed
    )
  }

  const effectSymbol = Symbol("effect")
  const activeReactiveEffectStack = []
  const ITERATE_KEY = Symbol("iterate")
  function isEffect(fn) {
    return fn != null && fn[effectSymbol] === true
  }
  function effect(fn, options = EMPTY_OBJ) {
    if (isEffect(fn)) {
      fn = fn.raw
    }

    const effect = function reactiveEffect(...args) {
      return run(effect, fn, args)
    }
    effect[effectSymbol] = true
    effect.active = true
    effect.raw = fn
    effect.scheduler = options.scheduler
    effect.onTrack = options.onTrack
    effect.onTrigger = options.onTrigger
    effect.onStop = options.onStop
    effect.computed = options.computed
    effect.deps = []

    if (!options.lazy) {
      effect()
    }
    return effect
  }
  function stop(effect) {
    if (effect.active) {
      cleanup(effect)
      if (effect.onStop) {
        effect.onStop()
      }
      effect.active = false
    }
  }
  function run(effect, fn, args) {
    if (!effect.active) {
      return fn(...args)
    }
    if (activeReactiveEffectStack.indexOf(effect) === -1) {
      cleanup(effect)
      try {
        activeReactiveEffectStack.push(effect)
        return fn(...args)
      } finally {
        activeReactiveEffectStack.pop()
      }
    }
  }
  function cleanup(effect) {
    const { deps } = effect
    if (deps.length) {
      for (let i = 0; i < deps.length; i++) {
        deps[i].delete(effect)
      }
      deps.length = 0
    }
  }

  let shouldTrack = true
  function track(target, type, key) {
    if (!shouldTrack) {
      return
    }

    const effect =
      activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
    if (effect) {
      if (type === "iterate" /* ITERATE */) {
        key = ITERATE_KEY
      }
      let depsMap = targetMap.get(target)
      if (depsMap === void 0) {
        targetMap.set(target, (depsMap = new Map()))
      }
      let dep = depsMap.get(key)
      if (dep === void 0) {
        depsMap.set(key, (dep = new Set()))
      }
      if (!dep.has(effect)) {
        dep.add(effect)
        effect.deps.push(dep)
        if (effect.onTrack) {
          effect.onTrack({ effect, target, type, key })
        }
      }
    }
  }

  function trigger(target, type, key, extraInfo) {
    const depsMap = targetMap.get(target)
    if (depsMap === void 0) {
      return
    }
    const effects = new Set()
    const computedRunners = new Set()

    if (type === "clear" /* CLEAR */) {
      depsMap.forEach(dep => {
        // CLEAR 时 trigger 所有的 effects
        addRunners(effects, computedRunners, dep)
      })
    } else {
      // SET | ADD | DELETE 时添加
      if (key !== void 0) {
        addRunners(effects, computedRunners, depsMap.get(key))
      }
      // ADD | DELETE 类型时, 执行 "iteration" 中的effect
      if (type === "add" /* ADD */ || type === "delete" /* DELETE */) {
        const iterationKey = Array.isArray(target) ? "length" : ITERATE_KEY
        addRunners(effects, computedRunners, depsMap.get(iterationKey))
      }
    }

    const run = effect => {
      scheduleRun(effect, target, type, key, extraInfo)
    }
    // 重要：必须先运行计算属性的effect，以便在运行依赖于它们的任何常规effect之前，使计算的getters无效.
    computedRunners.forEach(run)
    effects.forEach(run)
  }
  function addRunners(effects, computedRunners, effectsToAdd) {
    if (effectsToAdd !== void 0) {
      effectsToAdd.forEach(effect => {
        if (effect.computed) {
          computedRunners.add(effect)
        } else {
          effects.add(effect)
        }
      })
    }
  }
  function scheduleRun(effect, target, type, key, extraInfo) {
    if (effect.onTrigger) {
      effect.onTrigger(extend({ effect, target, key, type }, extraInfo))
    }
    if (effect.scheduler !== void 0) {
      effect.scheduler(effect)
    } else {
      effect()
    }
  }

  const refSymbol = Symbol("refSymbol")
  const convert = val => (isObject(val) ? reactive(val) : val)
  function ref(raw) {
    raw = convert(raw)
    const v = {
      [refSymbol]: true,
      get value() {
        track(v, "get" /* GET */, "")
        return raw
      },
      set value(newVal) {
        raw = convert(newVal)
        trigger(v, "set" /* SET */, "")
      },
    }
    return v
  }
  function isRef(v) {
    return v ? v[refSymbol] === true : false
  }
  function toRefs(object) {
    const ret = {}
    for (const key in object) {
      ret[key] = toProxyRef(object, key)
    }
    return ret
  }
  function toProxyRef(object, key) {
    const v = {
      [refSymbol]: true,
      get value() {
        return object[key]
      },
      set value(newVal) {
        object[key] = newVal
      },
    }
    return v
  }

  function computed(getterOrOptions) {
    const isReadonly = isFunction(getterOrOptions)
    const getter = isReadonly ? getterOrOptions : getterOrOptions.get
    const setter = isReadonly
      ? () => console.warn("computed value is readonly")
      : getterOrOptions.set
    let dirty = true
    let value

    const runner = effect(getter, {
      lazy: true,
      computed: true, // 将effect标记为计算属性effect，trigger时优先级更高
      scheduler: () => {
        dirty = true
      },
    })

    return {
      [refSymbol]: true,
      effect: runner, // 暴露出effect，可以进行 stop
      get value() {
        if (dirty) {
          value = runner()
          dirty = false
        }
        // 当在上层effect中访问计算的效果时，上层effect应该跟踪计算属性跟踪的所有依赖项.
        // 这也应适用于计算属性的嵌套
        trackChildRun(runner)
        return value
      },
      set value(newValue) {
        setter(newValue)
      },
    }
  }
  function trackChildRun(childRunner) {
    const parentRunner =
      activeReactiveEffectStack[activeReactiveEffectStack.length - 1]
    if (parentRunner) {
      for (let i = 0; i < childRunner.deps.length; i++) {
        const dep = childRunner.deps[i]
        if (!dep.has(parentRunner)) {
          dep.add(parentRunner)
          parentRunner.deps.push(dep)
        }
      }
    }
  }

  exports.ITERATE_KEY = ITERATE_KEY
  exports.computed = computed
  exports.effect = effect
  exports.stop = stop
  exports.toRaw = toRaw
  exports.toRefs = toRefs
  exports.ref = ref
  exports.readonly = readonly
  exports.reactive = reactive
  exports.isRef = isRef
  exports.isReadonly = function isReadonly(value) {
    return readonlyToRaw.has(value)
  }
  exports.isReactive = function isReactive(value) {
    return reactiveToRaw.has(value) || readonlyToRaw.has(value)
  }
  exports.markNonReactive = function markNonReactive(value) {
    nonReactiveValues.add(value)
    return value
  }
  exports.markReadonly = function markReadonly(value) {
    readonlyValues.add(value)
    return value
  }
  exports.resumeTracking = function resumeTracking() {
    shouldTrack = true
  }
  exports.pauseTracking = function pauseTracking() {
    shouldTrack = false
  }
  exports.lock = function lock() {
    LOCKED = true
  }
  exports.unlock = function unlock() {
    LOCKED = false
  }

  return exports
})({})