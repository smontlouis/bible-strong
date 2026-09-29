Pod::Spec.new do |s|
  s.name           = 'BibleStrongArchive'
  s.version        = '1.0.0'
  s.summary        = 'Extracts encrypted Bible Strong Offline copies'
  s.description    = 'Derives per-archive passwords natively and extracts AES ZIP Offline copies.'
  s.author         = 'Bible Strong'
  s.homepage       = 'https://bible-strong.app'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Same constraint as react-native-zip-archive, which already ships SSZipArchive.
  s.dependency 'SSZipArchive', '~> 2.5.5'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
