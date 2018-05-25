import * as shell from 'shelljs'
import * as path from 'path'

// github project name vs local folder name
const repositoryMap: { [key: string]: string } = {
  'organizer-management': 'huizhanren-management',
  'ex-show-web': 'ex-show'
}

const sentryOrganizer = 'tenswin'
// github project name vs sentry project name
const sentryProjectMap: { [key: string]: string } = {
  'ex-show-web': 'exshow'
}

const frontEndDir = 'c://work/front-end'

// TODO 某些步骤容易出错 加上重试机制 譬如pull from github容易失败
export class Task {
  private destDistDir: string
  private repositoryDir: string
  private repositoryDistDir: string
  private version: string
  constructor(
    private projectName: string,
    private needUploadSourceMapToSentry?: boolean,
    private jsUrlPrefix?: string, // http://exshow.xiaovbao.cn/static/js
    private localJsMapRelateDistDir?: string // dist/static/js
  ) {
    this.destDistDir = path.join(frontEndDir, repositoryMap[projectName] + '/dist')
    this.repositoryDir = path.join(frontEndDir, repositoryMap[projectName], 'repository', projectName)
    this.repositoryDistDir = path.join(this.repositoryDir, 'dist')
    console.log(`destDistDir: ${this.destDistDir}`)
    console.log(`repositoryDir: ${this.repositoryDir}`)
    console.log(`repositoryDistDir: ${this.repositoryDistDir}`)
  }

  run() {
    try {
      shell.echo(`run task staring!!! project name: ${this.projectName}`)
      this.pullFromGithub()
      this.runInstall()
      this.runBuild()
      this.copyToDestination()
      if (this.needUploadSourceMapToSentry) {
        this.uploadSourceMapToSentry()
      }
      shell.echo(`run task success!!! project name: ${this.projectName}`)
    } catch (e) {
      console.log(`run task failed; error: ${e.message}`)
    }
  }

  private pullFromGithub() {
    shell.echo(`start pull from github, project name: ${this.projectName}`)
    shell.cd(this.repositoryDir)
    const pullResult = shell.exec(`git pull origin master master`)

    if (pullResult.code === 0) {
      const packageJson = require(this.repositoryDir + '/package.json')
      this.version = packageJson.version
      console.log(`fetch package version from ${this.repositoryDir}; version: ${this.version}`)
      shell.echo(`git pull success`)
      return true
    } else {
      console.log(`pull from github failed; project name: ${this.projectName};`)
      throw new Error(`pull from github failed; project name: ${this.projectName};`)
    }
  }

  private runInstall() {
    shell.echo(`start npm install, project name: ${this.projectName}`)
    shell.cd(this.repositoryDir)
    const installResult = shell.exec(`npm install`)
    if (installResult.code === 0) {
      shell.echo(`npm install success`)
      return true
    } else {
      throw new Error(`npm install failed; project name: ${this.projectName};`)
    }
  }

  private runBuild() {
    shell.echo(`start npm run build, project name: ${this.projectName}`)
    shell.cd(this.repositoryDir)
    const buildResult = shell.exec(`npm run build`)
    if (buildResult.code === 0) {
      shell.echo(`npm run build success`)
      return true
    } else {
      throw new Error(`npm run build failed; project name: ${this.projectName};`)
    }
  }

  private copyToDestination() {
    shell.echo(`start copy build dist to destination dist dir`)
    shell.rm('-rf', this.destDistDir + '/*')
    shell.cp('-R', this.repositoryDistDir + '/*', this.destDistDir)
    console.log(`copy build dist to destination dist dir success; project name: ${this.projectName};`)
    return true

  }

  private uploadSourceMapToSentry() {
    shell.echo(`start upload source map to sentry; project name: ${this.projectName}`)

    if (!this.version) {
      throw new Error(`upload source map to sentry need version`)
    }
    const newReleaseResult = shell.exec(`sentry-cli releases -o ${sentryOrganizer} -p ${sentryProjectMap[this.projectName]} new ${this.version}`)
    if (newReleaseResult.code === 0) {
      shell.cd(this.repositoryDir)
      const uploadResult = shell.exec(`sentry-cli releases -o ${sentryOrganizer} -p ${sentryProjectMap[this.projectName]} files ${this.version} upload-sourcemaps --url-prefix ${this.jsUrlPrefix} ${this.localJsMapRelateDistDir}`)
      if (uploadResult.code === 0) {
        console.log(`upload source map to sentry success!!!`)
        return true
      }
      throw new Error(`upload source map to sentry failed;`)
    }
  }
}
