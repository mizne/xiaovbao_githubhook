import * as shell from 'shelljs'

export class Task {
  constructor(private projectName: string) {}

  pullFromGithub() {}

  runBuild() {}

  copyToDestination() {}
}
