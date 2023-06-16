Dynamically install dependencies

## use

```js
const { initPackge } = require(`sync-package`)

new Promise(async () => {
  const pkg = await initPackge(`lodash`, {
    mainPath: __dirname,
  })
  console.log(`pkg`, pkg.set)
})

```

## parameter

```js
/**
 * @param {string} pkg The dependencies to be installed. It is actually the same as the parameter after npm i
 * @param {object} param1 configuration
 * @param {boolean} param1.getRequire Whether to require after the installation is complete
 * @param {boolean} param1.requireName The name used when require. The default is automatic resolution. When using url to install, the program does not know the real name, and it needs to be specified at this time
 * @param {object} param1.env Environment variables during installation
 * @param {string} param1.mainPath what directory to install
 */
initPackge(pkg, param1)
```

## License
[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2017-present, xw
