const fs = require(`fs`)
const cp = require(`child_process`)
cp.execSync(`yarn remove lodash || echo remove lodash`, {stdio: `inherit`})
cp.execSync(`cd ../ && yarn pack --filename pkg.tgz`, {stdio: `inherit`})
cp.execSync(`yarn add ../pkg.tgz --cache-folder node_modules`, {stdio: `inherit`})

const { initPackge } = require(`sync-package`)

new Promise(async () => {
  const pkg = await initPackge(`lodash`, {
    mainPath: __dirname,
  })
  console.log(`pkg`, pkg.set)
})
