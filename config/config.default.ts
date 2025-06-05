import { EggAppConfig, EggAppInfo, PowerPartial } from 'egg';

export default (appInfo: EggAppInfo) => {
  const config = {} as PowerPartial<EggAppConfig>;

  // override config from framework / plugin
  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1730786984695_9153';

  // add your egg config in here
  config.middleware = [];

  config.cors = {
    origin: '*', // 允许所有来源
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH', // 允许的请求方法
  };

  // add your special config in here
  const bizConfig = {
    sourceUrl: `https://github.com/eggjs/examples/tree/master/${appInfo.name}`,
  };

  config.compress = {
    enable: false,
  };
  config.etag = false;
  // the return config will combines to EggAppConfig
  return {
    ...config,
    ...bizConfig,
  };
};
