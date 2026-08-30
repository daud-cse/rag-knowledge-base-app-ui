export const environment = {
  production: true,
  /** Container Apps ingress for ragkb-api (Central US).
   *  Static Web Apps Free cannot proxy to Container Apps, so the browser calls
   *  this origin directly and the API allows it via Cors__Origins__0.         */
  apiBase: 'https://ragkb-api.yellowfield-bdf43b6f.centralus.azurecontainerapps.io'
};
