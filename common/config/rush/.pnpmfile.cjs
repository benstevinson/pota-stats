'use strict';

/**
 * When using the PNPM package manager, you can use pnpmfile.js to workaround
 * temporary dependencies issues.
 *
 * For more information, see:
 * https://pnpm.io/pnpmfile
 */
module.exports = {
  hooks: {
    readPackage(packageJson, context) {
      return packageJson;
    }
  }
};
