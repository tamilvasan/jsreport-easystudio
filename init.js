var init = function(appModule,config, localization){

    const returnPromise = function (client,method, args)
    {
        return new Promise( function(fulfill, reject) { 
            try
            {
                client.methods[method](
                    args,
                    function (data, response) { fulfill (data);}
                );
            }
            catch(ex)
            {
                reject(ex);
            }
        });
    };

    appModule.language =  config.language || "en-US";
    localization=localization||{};

    if (config.localization)
        appModule.localization= Object.assign(localization, config.localization);
    else
        appModule.localization=localization;

    if (!config.templateStore.type){
        throw "template store type not specified";
    }
    //Initialize template store
    if (config.templateStore.type ==="api")
    {


        if (!config.templateStore.url){
            throw "config.templateStore.url missing"
        }
        var Client = require('node-rest-client').Client;
        if (!config.templateStore.clientOptions){
            appModule.templateStoreClient = new Client();
        }else{
            appModule.templateStoreClient = new Client(config.templateStore.clientOptions);
        }
        if ( config.templateStore.urlAll){
            appModule.templateStoreClient.registerMethod("getAllTemplates", config.templateStore.urlAll|| config.templateStore.url , "GET");
        }
        if ( config.templateStore.urlNew){
            appModule.templateStoreClient.registerMethod("getNewTemplate", config.templateStore.urlNew , "GET");
        }
        appModule.templateStoreClient.registerMethod("getTemplateById", config.templateStore.url.replace(config.templateStore.idPlaceHolder || ":id", "${id}") , "GET");
        appModule.templateStoreClient.registerMethod("setTemplateById", config.templateStore.url.replace(config.templateStore.idPlaceHolder || ":id", "${id}") , "POST");

        appModule.getAllTemplates = function(){
            return returnPromise(appModule.templateStoreClient,"getAllTemplates",{});
        };
        appModule.getTemplate = function(id){
            return returnPromise(appModule.templateStoreClient,"getTemplateById",{ "path":{"id":id}});
        };
        appModule.setTemplate = function(id, data){
            return returnPromise(appModule.templateStoreClient,"setTemplateById",{ "path":{"id":id}, "data":data});
        };
    }
    else if (config.templateStore.type==="func"){
        appModule.getAllTemplates =config.templateStore.getAllTemplates;
        appModule.getTemplate =config.templateStore.getTemplate;
        appModule.setTemplate =config.templateStore.setTemplate;
        appModule.getNewTemplate =config.templateStore.getNewTemplate;
    }
    else{throw "invalid config.templateStore.type = "+config.templateStore.type+" ... but can be 'func' or 'api', nothing else";}

    //Initialize template store
    if (config.dataProviderStores)
    {
        appModule.dataProviderStores={};
        config.dataProviderStores.forEach(function(dsConfig, idx) {
            var ds = {};
            if (!dsConfig.id){ throw "Invalid dataProviderStore config : no Id set for" + JSON.stringify(dsConfig);}

            if (dsConfig.type==="api"){
                if (!dsConfig.url){
                    throw "config.dataProviderStores["+idx+"].url missing"
                }
                var Client = require('node-rest-client').Client;
                if (!dsConfig.clientOptions){
                    ds.dataProviderClient = new Client();
                }else{
                    ds.dataProviderClient = new Client(dsConfig.clientOptions);
                }
                ds.dataProviderClient.registerMethod("getData", dsConfig.url.replace(dsConfig.sourceIdPlaceHolder || ':sourceId', "${id}")
                , "GET");

               ds.getData = function(sourceId, parameters){
                   parameters = parameters||{}
                   return returnPromise(ds.dataProviderClient,"getData", { "path":{"id":sourceId}, "parameters":parameters });
                };

               ds.dataProviderClient.registerMethod("getDemoData", (dsConfig.templateDataUrl || dsConfig.url).replace(dsConfig.sourceIdPlaceHolder || ':sourceId', "${id}")
               , "GET");
               ds.getDemoData =  function(sourceId){
                    return returnPromise(ds.dataProviderClient,"getDemoData", { "path":{"id":sourceId}});
               }

            }
            else if (dsConfig.type==="func"){
                ds.getData =dsConfig.getData;
                if (dsConfig.getDemoData)
                {
                    ds.getDemoData=dsConfig.getDemoData;
                }
                else{
                    ds.getDemoData = ds.getData;
                }
            }
            else{throw "config.dataProviderStores["+idx+"].type ="+config.templateStore.type+" ... but can be 'func' or 'api', nothing else";}


            appModule.dataProviderStores[dsConfig.id]=ds;
        });
    }

    appModule.createDataParametersForExample =   function createDataParametersForExample(obj, renderingEngine, optionTypes){

        optionTypes=optionTypes || {
            handlebars:{
                fieldPlaceholder:"@@@field@@@",
                arrayStartPattern:"{{# forEach @@@field@@@ }}",
                arrayEndPattern:"{{/forEach}}",
                fieldPattern:"{{@@@field@@@}}"
            },
            jsrender:{
                fieldPlaceholder:"@@@field@@@",
                arrayStartPattern:"{{ for @@@field@@@ }}",
                arrayEndPattern:"{{/for}}",
                fieldPattern:"{{: @@@field@@@ }}"
            }
        };
    
        function createDataParametersForExampleCore (obj, path, group, options){
            var resArray = [];
    
            Object.keys(obj).forEach(function(p)
            {
                var currPath = path ?  path + '.' + p : p;
                if(Array.isArray(obj[p])){
                    var newGroup = {
                            start: options.arrayStartPattern.replace(options.fieldPlaceholder, currPath),
                            end: options.arrayEndPattern.replace(options.fieldPlaceholder, currPath)
                        };
                    resArray.push(
                        {
                            caption:p+ '[]',
                            value: newGroup.start + "<br/><br/>"+newGroup.end,
                            //get schema only by first element
                            subItems: createDataParametersForExampleCore( obj[p][0],null,newGroup , options)
                        }
                    );
    
                }
                else if (typeof obj[p] ===typeof {} && obj[p]!==null)
                {
                    
                    var subItems = createDataParametersForExampleCore( obj[p],currPath,group, options);
                    resArray.push(
                        {caption: p, "subItems":subItems}
                    );
                }
                else
                {
                    resArray.push(
                        {
                            caption:p ,  
                            group:group,
                            value: options.fieldPattern.replace(options.fieldPlaceholder, currPath)
                        }
                    );
                }
            });
            return resArray;
        }
        
        var res = createDataParametersForExampleCore(obj, null,null, renderingEngine? optionTypes[renderingEngine]:optionTypes[Object.keys(optionTypes)[0]]);
        
        return res;
    };
   

    return appModule;
}

exports.init = init;
exports.create = function (config, localization){ return init({}, config,localization)};