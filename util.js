const path = require(`path`)

function delRequireCache(filePath) {
  delete require.cache[require.resolve(filePath)]
}

/**
 * 让函数运行不报错
 */
function tryFn(fn, ...arg) {
  try {
    return fn(...arg)
  } catch (error) {
    return undefined
  }
}

/**
 * 获取当前 npm 配置文件中使用的注册表地址, 而不是环境变量中的地址
 */
async function getNpmRegistry() {
  const cp = require(`child_process`)
  const url = tryFn(() => cp.execSync(`npm config get registry`, {
    env: {
      /**
       * 设置为空, 即可避免使用当前环境变量中的值而是使用 npm 配置文件中的值
       * 为了避免通过 yarn 启动时, 获取到的值是 registry.yarnpkg.com
       * 但我们需要的其实是需要 npm 本身配置的值, 例如通过 nrm use 来切换的配置
       */
      NPM_CONFIG_REGISTRY: undefined,
    },
  }).toString().trim())
  return url
}


/**
 * 自动安装依赖
 * // ? todo 当使用 yarn mm remote 或 npm run mm remote 的包管理器启动程序时, 看不到实时输出效果,
 *     需要使用 mm remote 这种直接调用可执行文件的方式才能实时输出, 不知道为什么
 * 注意, 假设安装 a 依赖后, a 依赖会被存储到 dependencies 中, 建议保留它, 因为可能是对等依赖
 *     例如 joi-to-swagger 依赖 joi, 这要求在父项目的 dependencies 中显式存在 joi 并已安装
 * @param {*} param0
 * @returns
 */
async function installPackage({cwd, env, pkg, attempt = 3, requireName}) {
  const registryUrl = await getNpmRegistry()
  const { INIT_PACKAGE_REGISTRY } = process.env
  const useUrl = registryUrl || INIT_PACKAGE_REGISTRY || `https://registry.npm.taobao.org/`
  process.env.NPM_CONFIG_REGISTRY = useUrl
  cwd = cwd.replace(/\\/g, `/`)
  // 注意: 修改为 npm 时某些依赖会无法安装, 需要使用 cnpm 成功率较高
  const { manager } = require(`whatnpm`)
  let installEr = manager(cwd).er || `npm`
  if(hasPackage(installEr) === false) { // 如果安装器不存在, 则退出, 注意: 可能遇到安装器判断错误的情况.
    throw new Error(`Please install mockm with npm and try again`)
  }
  // 不再使用 --registry 参数, 因为某些管理器要求此值与 lock 中的值一致
  // 不再使用 npx , 因为它在新版本需要交互式确认
  const cmd = {
    npm: `npm add ${pkg}`,
    pnpm: `pnpm add ${pkg}`, // pnpm 其实不支持 --registry 参数
    cnpm: `cnpm i ${pkg}`, // cnpm 其实不支持 add 参数
    yarn: `yarn add ${pkg}`,
  }[installEr]
  let attemptNum = attempt // 重试次数
  do {
    const cp = require(`child_process`)
    cp.execSync(cmd, {
      stdio: `inherit`, // 实时转发子进程的输出到当前控制台中
      cwd,
      env: {
        ...process.env,
        ...env,
        NPM_CONFIG_REGISTRY: useUrl,
      },
    })
    attemptNum = attemptNum - 1
  } while (hasPackage(requireName) === false && attemptNum > 0)
  const hasPackageRes = hasPackage(requireName)
  return hasPackageRes
}

function hasFile(filePath) { // 判断文件或目录是否存在
  const fs = require(`fs`)
  return fs.existsSync(filePath)
}


/**
 * 获取本地 package 版本号
 * @param {string} name packageName
 * @param {object} param1 选项
 * @param {array} param1.packagePath 指定路径
 */
function getLocalVersion(name, {packagePath} = {}) { // 从本地获取版本号
  const pathList = [
    ...require.main.paths,
    `${require(`path`).parse(process.execPath).dir}/node_modules`,
    `${require(`path`).parse(process.execPath).dir}/../lib/node_modules`,
  ]
  packagePath = packagePath || pathList.find(path => hasFile(`${path}/${name}/package.json`))
  if(packagePath) {
    return require(`${packagePath}/${name}/package.json`).version // 从 package 中获取版本
  }
}

function hasPackage(name, cfg = {}) { // 是还存在某个包
  return Boolean(getLocalVersion(name))
}

/**
 * 如果某个依赖不存在, 则安装它
 * @param {*} pkg 要安装的依赖, 与 npm i 后面的参数一致
 * @param {object} param1 配置
 * @param {boolean} param1.getRequire 是否安装完成后进行 require
 * @param {boolean} param1.requireName require 时使用的名称, 默认为自动解析, 例如当使用 url 安装时程序是无法知道真实名称的, 需要指定
 * @param {object} param1.env 安装时的环境变量
 * @param {string} param1.msg 依赖不存在时提示的消息
 */
async function initPackge(
  pkg,
  {
    getRequire = true,
    requireName,
    env = {},
    msg,
    mainPath = path.join(process.cwd(), `../`), // 主程序目录
  } = {},
) {
  try {
    const packageJson =  require(`${mainPath}/package.json`)

    let pkgVersion = ``
    if(pkg.includes(`://`) === false) {
      let nameEndsAt = pkg[0] === `@` ? pkg.slice(1).indexOf(`@`) + 1 : pkg.indexOf(`@`)
      pkgVersion = nameEndsAt > 0 ? pkg.slice(nameEndsAt + 1) : ``
      if(pkgVersion === ``) { // 若未指定版本时, 从已声明的依赖中选择版本
        pkgVersion = pkgVersion || (packageJson.pluginDependencies || {})[pkg] || (packageJson.optionalDependencies || {})[pkg] || packageJson.dependencies[pkg] || ``
        pkg = pkgVersion ? `${pkg}@${pkgVersion}`: pkg
      }
    }
    const requireNameNew = requireName || (pkgVersion ? pkg.replace(`@${pkgVersion}`, ``) : pkg)
    const hasPackageRes = hasPackage(requireNameNew)
    if(hasPackageRes === false) { // 如果依赖不存在, 则安装它
      msg && console.log(msg)
      await installPackage({cwd: mainPath, env, pkg, requireName: requireNameNew })
    }
    if(getRequire) {
      delRequireCache(requireNameNew)
      return require(requireNameNew)
    }
  } catch (err) {
    console.log(`err`, err)
  }
}

module.exports = {
  initPackge,
}
