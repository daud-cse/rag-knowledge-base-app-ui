export const environment = {
  production: true,
  /** Container Apps ingress FQDN. Replace after `az containerapp create`:
   *  az containerapp show -n ragkb-api -g rag_knowledge_base_app \
   *    --query properties.configuration.ingress.fqdn -o tsv          */
  apiBase: 'https://REPLACE-WITH-CONTAINER-APP-FQDN'
};
