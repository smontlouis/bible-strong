// Not needed on new firebase version
// https://github.com/invertase/react-native-firebase/issues/8020
// withBoringSSLFix.js

const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const withBoringSSLFix = config => {
  return withDangerousMod(config, [
    'ios',
    config => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      )
      let podfileContents = fs.readFileSync(podfilePath, 'utf-8')

      //  Fix for the Podfile
      const fix = `

    # Fix BoringSSL-GRPC issue unsupported option '-G'
    # Reason: BoringSSL-GRPC doesn't compatible with Xcode 16
    # https://github.com/invertase/react-native-firebase/issues/8020?fbclid=IwY2xjawFc9KxleHRuA2FlbQIxMQABHenJMPNnLPuWcojthZjTcuIvoSKes2ATG69IuneRy2bUjAH3J2nYr-5nlQ_aem_XnJhQUj0eNzBy5xl6kjfmw#issuecomment-2359198907
    installer.pods_project.targets.each do |target|
      if target.name == 'BoringSSL-GRPC'
        target.source_build_phase.files.each do |file|
          if file.settings && file.settings['COMPILER_FLAGS']
            flags = file.settings['COMPILER_FLAGS'].split
            flags.reject! { |flag| flag == '-GCC_WARN_INHIBIT_ALL_WARNINGS' }
            file.settings['COMPILER_FLAGS'] = flags.join(' ')
          end
        end
      end
    end
`
      if (!podfileContents.includes("if target.name == 'BoringSSL-GRPC'")) {
        const findString = 'post_install do |installer|'
        const postInstallIndex = podfileContents.indexOf(findString)
        if (postInstallIndex !== -1) {
          podfileContents =
            podfileContents.slice(0, postInstallIndex + findString.length) +
            fix +
            podfileContents.slice(postInstallIndex + findString.length)
        }
        fs.writeFileSync(podfilePath, podfileContents)
      }

      return config
    },
  ])
}

module.exports = withBoringSSLFix
