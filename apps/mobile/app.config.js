module.exports = ({ config }) => {
  const isEASBuild = process.env.EAS_BUILD === 'true';

  return {
    ...config,
    updates: isEASBuild
      ? {
          url: 'https://u.expo.dev/40432ac1-55a2-4bfa-985e-a51562398743',
          enabled: true,
          checkAutomatically: 'ON_LOAD',
          fallbackToCacheTimeout: 0,
        }
      : {
          enabled: false,
          checkAutomatically: 'NEVER',
        },
  };
};
