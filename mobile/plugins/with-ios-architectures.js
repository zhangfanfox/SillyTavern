const { withXcodeProject } = require('@expo/config-plugins');

function withIosArchitectures(config, { architectures }) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    
    // Set architectures for all build configurations
    const buildConfigurations = ['Debug', 'Release'];
    
    buildConfigurations.forEach(configName => {
      // Set ARCHS to only arm64
      project.updateBuildProperty('ARCHS', architectures.join(' '), configName);
      
      // Set VALID_ARCHS to only arm64
      project.updateBuildProperty('VALID_ARCHS', architectures.join(' '), configName);
      
      // Exclude x86_64 from simulator builds if needed
      project.updateBuildProperty('EXCLUDED_ARCHS', 'x86_64', configName);
    });

    return config;
  });
}

module.exports = withIosArchitectures;