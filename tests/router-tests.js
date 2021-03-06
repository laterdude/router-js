'use strict';
import sinon from "sinon";
import assert from "assert";
import Promise from "promise";
import Module from "module-js";
import _ from "lodash";
import Router from "./../src/router";


describe('Router', function () {
    var mockPage,
        mockModule,
        requireStub,
        windowStub,
        windowMock;

    var createPageStub = function () {
        var page = sinon.createStubInstance(Module);
        page.load.returns(Promise.resolve());
        page.hide.returns(Promise.resolve());
        page.show.returns(Promise.resolve());
        page.error.returns(Promise.resolve());
        page.el = document.createElement('div');
        return page;
    };

    var createModuleStub = function () {
        var module = sinon.createStubInstance(Module);
        module.load.returns(Promise.resolve());
        module.show.returns(Promise.resolve());
        module.hide.returns(Promise.resolve());
        module.error.returns(Promise.resolve());
        module.el = document.createElement('div');
        return module;
    };

    beforeEach(function () {
        windowStub = sinon.stub(Router.prototype, 'getWindow');
        windowMock = {
            history: {
                pushState: sinon.stub(),
                replaceState: sinon.stub()
            },
            location: {
                pathname: '/',
                hash: '',
                hostname: window.location.hostname // use current hostname of page
            },
            addEventListener: sinon.stub(), // dont actually trigger any popstate events!
            removeEventListener: sinon.stub()
        };
        windowStub.returns(windowMock);

        // set up mock page and set defaults
        mockPage = createPageStub();
        mockModule = createModuleStub();

        requireStub = sinon.stub(window, 'require');
    });

    afterEach(function () {
        windowStub.restore();
        requireStub.restore();
    });

    it('should return query params from provided url', function () {
        var router = new Router();
        router.start({});
        var url = 'http://my-testable-url.com/my/testable/path/?my=little&tea=pot';
        var queryParams = router.getQueryParams(url);
        assert.deepEqual({'my': 'little', 'tea': 'pot'}, queryParams, 'query params parsed from url: ' + JSON.stringify(queryParams));
        router.stop();
    });

    it('should return query params from current window url', function () {
        var router = new Router();
        windowMock.location.href = 'http://my-testable-url.com/my/testable/path/?my=little&tea=pot';
        windowMock.location.hash = '';
        windowStub.returns(windowMock);
        router.start({});
        var queryParams = router.getQueryParams();
        assert.deepEqual({'my': 'little', 'tea': 'pot'}, queryParams, 'query params parsed from url: ' + JSON.stringify(queryParams));
        router.stop();
    });

    it('should fire onRouteChange callback when a url is triggered', function () {
        var urlChangeSpy = sinon.spy();
        var router = new Router({onRouteChange: urlChangeSpy});
        router.start();
        var url = 'my/testable/url';
        router.triggerRoute(url);
        assert.equal(urlChangeSpy.args[0][0], url, 'url change spy was called with route when url was triggered');
        assert.ok(urlChangeSpy.calledOn(router), 'onUrlChange was called with router as the context');
        router.stop();
    });

    it('should call pushState with correct path when triggering url', function () {
        var url = 'my/testable/url';
        var pagesConfig = {};
        pagesConfig[url] = {};
        var router = new Router({
            pagesConfig: pagesConfig
        });
        requireStub.withArgs(url).returns(mockPage);
        router.start();
        return router.triggerRoute(url)
            .then(function () {
                assert.equal(windowMock.history.pushState.args[0][0].path, url, 'history.pushState() was called with correct data history');
                assert.equal(windowMock.history.pushState.args[0][2], url, 'history.pushState() was called with correct url parameter');
                router.stop();
            });
    });

    it('should call replaceState with correct path when triggering a new route with replace option set to "true"', function () {
        var url = 'my/testable/url';
        var pagesConfig = {};
        pagesConfig[url] = {};
        var router = new Router({pagesConfig: pagesConfig});
        var mockPage = createPageStub();
        requireStub.withArgs(url).returns(mockPage);
        router.start();
        return router.triggerRoute(url, {replace: true})
            .then(function () {
                assert.equal(windowMock.history.replaceState.args[0][0].path, url, 'was called with correct data history');
                assert.equal(windowMock.history.replaceState.args[0][2], url, 'was called with correct url parameter');
                assert.equal(windowMock.history.pushState.callCount, 0, 'pushState was not called');
                router.stop();
            });
    });

    it('should NOT call pushState when triggering a new route with triggerUrlChange set to "false"', function () {
        var url = 'my/testable/url';
        var pagesConfig = {};
        pagesConfig[url] = {};
        var router = new Router({pagesConfig: pagesConfig});
        var mockPage = createPageStub();
        requireStub.withArgs(url).returns(mockPage);
        router.start();
        return router.triggerRoute(url, {triggerUrlChange: false})
            .then(function () {
                assert.equal(windowMock.history.pushState.callCount, 0);
                router.stop();
            });
    });

    it('should NOT call replaceState when triggering a new route with triggerUrlChange set to "false"', function () {
        var url = 'my/testable/url';
        var pagesConfig = {};
        pagesConfig[url] = {};
        var router = new Router({pagesConfig: pagesConfig});
        var mockPage = createPageStub();
        requireStub.withArgs(url).returns(mockPage);
        router.start();
        return router.triggerRoute(url, {triggerUrlChange: false})
            .then(function () {
                assert.equal(windowMock.history.replaceState.callCount, 0);
                router.stop();
            });
    });

    it('should resolve page load and NOT require script if there is no script url associated for the page in the route config', function () {
        // setup
        var pageUrl = 'my/index/with/no/script/url';
        var dataUrl = 'get/my/data';
        var pagesConfig = {};
        pagesConfig[pageUrl] = {
            data: dataUrl
        };
        var mockData = {};
        mockPage.fetchData.returns(Promise.resolve(mockData));
        var router = new Router({
            pagesConfig: pagesConfig
        });
        router.start();
        return router.triggerRoute(pageUrl)
            .then(function () {
                assert.deepEqual(requireStub.callCount, 0);
                router.stop();
            });
    });

    it('should resolve module load and NOT attempt to require its script when there is no script specified for the module in the route config', function () {
        var pageUrl = 'my/index/with/no/script/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var pageScript = 'path/to/myscript';
        modulesConfig[moduleName] = {};
        pagesConfig[pageUrl] = {
            script: pageScript,
            modules: [moduleName]
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        var requireStubCallCount = 0;
        router.start();
        requireStub.withArgs(pageScript).returns(mockPage);
        requireStubCallCount++;
        return router.triggerRoute(pageUrl)
            .then(function () {
                assert.deepEqual(requireStub.callCount, requireStubCallCount);
                router.stop();
            });
    });

    it('should fire onPageLoad callback option when a url is triggered', function () {
        var pageUrl = 'my/page/load/event/url';
        var pagesConfig = {};
        pagesConfig[pageUrl] = {};
        requireStub.withArgs(pageUrl).returns(mockPage);
        var pageLoadSpy = sinon.spy();
        var router = new Router({pagesConfig: pagesConfig, onPageLoad: pageLoadSpy});
        router.start();
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(pageLoadSpy.args[0][0], pageUrl);
            assert.ok(pageLoadSpy.calledOn, router);
            router.stop();
        });
    });

    it('should call the load method of the page entry in the route config that has a regex', function () {
        // setup
        var pageUrl = 'test/url';
        var pagesConfig = {};
        var scriptUrl = 'my/skript';
        pagesConfig[pageUrl + '(/)?$'] = {script: scriptUrl};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        requireStub.withArgs(scriptUrl).returns(mockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockPage.load.callCount, 1);
            router.stop();
        });
    });

    it('should pass any options object specified for a module in routes config to the module\'s instantiation', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'myCustomModule';
        var moduleOptionKey = 'my';
        var moduleOptionVal = 'moduleOptions';
        var moduleScriptUrl = 'path/to/module/script';
        var pageScriptUrl = 'path/to/page/script';
        modulesConfig[moduleName] = {
            script: moduleScriptUrl
        };
        modulesConfig[moduleName][moduleOptionKey] = moduleOptionVal;
        pagesConfig[pageUrl] = {
            script: pageScriptUrl,
            modules: [moduleName]
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var pageClass = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageClass);

        var moduleInitializeStub = sinon.stub().returns(mockModule);
        requireStub.withArgs(moduleScriptUrl).returns(moduleInitializeStub);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(moduleInitializeStub.args[0][1][moduleOptionKey], moduleOptionVal);
            router.stop();
        });
    });

    it('getting current url params when NO route has been triggered', function () {
        var router = new Router({pagesConfig: {}});
        var path = 'test';
        windowMock.location.hash = '#' + path;
        windowStub.returns(windowMock);
        router.start();
        assert.deepEqual(router.getRelativeUrlParams(), [path], 'calling getRelativeUrlParams() before triggering a route returns correct url');
        router.stop();
    });

    it('getting current url params when a route has been triggered', function () {
        var router = new Router({pagesConfig: {}});
        router.start();
        var url = 'my/url';
        router.triggerRoute(url);
        assert.deepEqual(router.getRelativeUrlParams(), ['my', 'url'], 'getRelativeUrlParams() returns correct url params of the url that was triggered');
        router.stop();
    });

    it('getting current url when a route has been triggered', function () {
        var router = new Router({pagesConfig: {}});
        router.start();
        var url = 'my/url';
        router.triggerRoute(url);
        assert.deepEqual(router.getRelativeUrl(), url, 'getRelativeUrl() returns correct url that was triggered');
        router.stop();
    });

    it('getting the current url that contains a leading slash', function () {
        var router = new Router({pagesConfig: {}});
        router.start();
        var url = '/leading/slash/url';
        router.triggerRoute(url);
        assert.deepEqual(router.getRelativeUrl(), 'leading/slash/url', 'getRelativeUrl() returns the url without the slash');
        router.stop();
    });

    it('should call triggerRoute() with new url and triggerUrlChange set to false when pop state changes', function () {
        var popStateListener = windowMock.addEventListener.withArgs('popstate');
        var router = new Router({pagesConfig: {}});
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        router.start();
        var url = 'my/url';
        var event = {state: {path: url}};
        popStateListener.callArgWith(1, event); // trigger pop state event!
        assert.equal(triggerRouteSpy.args[0][0], url);
        assert.equal(triggerRouteSpy.args[0][1].triggerUrlChange, false);
        router.stop();
    });

    it('should NOT call triggerRoute() when pop state changes and does not have a state', function () {
        var popStateListener = windowMock.addEventListener.withArgs('popstate');
        var router = new Router({pagesConfig: {}});
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        router.start();
        var url = 'my/url';
        var event = {};
        popStateListener.callArgWith(1, event); // trigger pop state event!
        assert.equal(triggerRouteSpy.callCount, 0);
        router.stop();
    });

    it('loadPage() should pass the styles property of the matching route config of the url requested to the associated page\'s constructor', function () {
        // setup
        var pageUrl = 'my/real/url';
        var pageScriptUrl = 'path/to/page/script';
        var stylesUrls = ['get/my/data'];
        var pagesConfig = {};
        pagesConfig[pageUrl] = {script: pageScriptUrl, styles: stylesUrls};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        var showPageStub = sinon.stub(router, 'showPage').returns(Promise.resolve());
        return router.loadPage(pageUrl)
            .then(function () {
                assert.deepEqual(pageConstructorStub.args[0][1].styles, stylesUrls);
                router.stop();
                showPageStub.restore();
            });
    });

    it('registerUrl() method should call window.history.pushState() with correct parameters', function () {
        var pageUrl = 'my/real/url';
        var router = new Router();
        router.start();
        router.registerUrl(pageUrl);
        assert.equal(windowMock.history.pushState.args[0][2], pageUrl, 'pushState was called with new url');
        router.stop();
    });

    it('registerUrl() method should return the registered url as the current path', function () {
        var pageUrl = 'my/real/url';
        var router = new Router();
        router.start();
        router.registerUrl(pageUrl);
        assert.equal(router.getRelativeUrl(), pageUrl);
        router.stop();
    });

    it('should load an intercepted url path via onRouteRequest callback instead of the original requested url', function () {
        var secondTestUrl = 'my/second/url';
        var firstPageUrl = 'my/real/url';
        var secondPageRouteRegex = '^' + secondTestUrl;
        var firstPageRouteRegex = '^' + firstPageUrl;
        var firstPageScriptUrl = 'path/to/my/script.js';
        var secondPageScriptUrl = 'path/to/my/script2.js';
        var pagesConfig = {};
        pagesConfig[firstPageRouteRegex] = {script: firstPageScriptUrl};
        pagesConfig[secondPageRouteRegex] = {script: secondPageScriptUrl};
        var onRouteRequestStub = sinon.stub();
        var router = new Router({
            pagesConfig: pagesConfig,
            onRouteRequest: onRouteRequestStub
        });
        var loadPageStub = sinon.stub(router, 'loadPage').returns(Promise.resolve());
        router.start();
        // redirect to new route
        onRouteRequestStub.returns(Promise.resolve(secondTestUrl));
        return router.triggerRoute(firstPageUrl).then(function () {
            assert.equal(loadPageStub.args[0][0], secondTestUrl, 'loadPage() was called with second url');
            assert.equal(loadPageStub.callCount, 1, 'loadPage() was only called once');
            router.stop();
            loadPageStub.restore();
        });
    });

    it('should register the new url returned by onRouteRequest callback into history', function () {
        var secondPageUrl = 'my/second/url';
        var firstPageUrl = 'my/real/url';
        var firstPageRouteRegex = '^' + firstPageUrl;
        var secondPageRouteRegex = '^' + secondPageUrl;
        var firstPageScriptUrl = 'path/to/my/script.js';
        var secondPageScriptUrl = 'path/to/my/script2.js';
        var pagesConfig = {};
        pagesConfig[firstPageRouteRegex] = {script: firstPageScriptUrl};
        pagesConfig[secondPageRouteRegex] = {script: secondPageScriptUrl};
        var onRouteRequestStub = sinon.stub();
        var router = new Router({
            pagesConfig: pagesConfig,
            onRouteRequest: onRouteRequestStub
        });
        var loadPageStub = sinon.stub(router, 'loadPage').returns(Promise.resolve());
        requireStub.withArgs(firstPageScriptUrl).returns(mockPage);
        var registerUrlStub = sinon.stub(router, 'registerUrl');
        router.start();
        // redirect to new route
        onRouteRequestStub.returns(Promise.resolve(secondPageUrl));
        return router.triggerRoute(firstPageUrl).then(function () {
            assert.equal(registerUrlStub.args[1][0], secondPageUrl, 'new url was passed to second registerUrl() call');
            router.stop();
            registerUrlStub.restore();
            loadPageStub.restore();
        });
    });

    it('should register the original url into history even if onRouteRequest callback returns a new url', function () {
        var secondTestUrl = 'my/second/url';
        var firstPageUrl = 'my/real/url';
        var firstPageRouteRegex = '^' + firstPageUrl;
        var secondPageRouteRegex = '^' + secondTestUrl;
        var firstPageScriptUrl = 'path/to/my/script.js';
        var secondPageScriptUrl = 'path/to/my/script2.js';
        var pagesConfig = {};
        pagesConfig[firstPageRouteRegex] = {script: firstPageScriptUrl};
        pagesConfig[secondPageRouteRegex] = {script: secondPageScriptUrl};
        var onRouteRequestStub = sinon.stub();
        requireStub.withArgs(firstPageScriptUrl).returns(mockPage);
        var router = new Router({
            pagesConfig: pagesConfig,
            onRouteRequest: onRouteRequestStub
        });
        var loadPageStub = sinon.stub(router, 'loadPage').returns(Promise.resolve());
        var registerUrlStub = sinon.stub(router, 'registerUrl');
        router.start();
        // redirect to new route
        onRouteRequestStub.returns(Promise.resolve(secondTestUrl));
        return router.triggerRoute(firstPageUrl).then(function () {
            assert.equal(registerUrlStub.args[0][0], firstPageUrl, 'original url was added to history');
            router.stop();
            loadPageStub.restore();
            registerUrlStub.restore();
        });
    });


    it('should call hide method on a previous page when a new page is requested', function () {
        var firstPageUrl = 'my/page/url';
        var secondPageUrl = 'two/second/page';
        var pagesConfig = {};
        var firstPageScriptUrl = 'path/to/page/script';
        var secondPageScriptUrl = 'second/path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[firstPageUrl] = {
            template: pageTemplateUrl,
            script: firstPageScriptUrl
        };
        pagesConfig[secondPageUrl] = {
            template: pageTemplateUrl,
            script: secondPageScriptUrl
        };
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptUrl).returns(mockPage);
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        return router.triggerRoute(firstPageUrl).then(function () {
            // register first url into window state
            router.history = [{path: firstPageUrl}];
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(mockPage.hide.callCount, 1);
                router.stop();
            });
        });
    });

    it('should only load global modules once, even when module is assigned to multiple pages in routes config', function () {
        // setup
        var pageUrl = 'my/page/url';
        var secondPageUrl = 'second/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleHtml = "<div>my module content</div>";
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        pagesConfig[secondPageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var pageHtml = '<div></div>';
        mockPage.getTemplate.returns(Promise.resolve(pageHtml));
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        mockModule.getTemplate.withArgs(moduleTemplateUrl).returns(Promise.resolve(moduleHtml));
        requireStub.returns(mockModule);
        mockModule.appendEl = sinon.spy();
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(mockModule.load.callCount, 1,  'load call was only triggered once even though module appears on multiple pages');
                router.stop();
            });
        });
    });

    it('should NOT call global module hide() method when navigating to page that does not have it', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleHtml = "<div>my module content</div>";
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var pageHtml = '<div></div>';
        mockPage.getTemplate.returns(Promise.resolve(pageHtml));
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        mockModule.getTemplate.withArgs(moduleTemplateUrl).returns(Promise.resolve(moduleHtml));
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.hide.callCount, 0,  'hide() was not called on initial route because it has not yet been shown');
            router.stop();
        });
    });

    it('all modules associated with a page should show() when requesting a route to a page that has the modules designated', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var firstModuleName = 'myFIRSTCustomModule';
        var firstModuleScriptUrl = 'path/to/first/script';
        var secondModuleName = 'myCustomModule2';
        var secondModuleScriptUrl = 'second/path/to/second/script';
        modulesConfig[firstModuleName] = {
            script: firstModuleScriptUrl
        };
        modulesConfig[secondModuleName] = {
            script: secondModuleScriptUrl
        };
        var pageScriptUrl = 'path/to/page/script';
        pagesConfig[pageUrl] = {
            modules: [
                secondModuleName,
                firstModuleName
            ],
            script: pageScriptUrl
        };
        var pageHtml = '<div></div>';
        mockPage.getTemplate.returns(Promise.resolve(pageHtml));
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        var firstMockModule = createModuleStub();
        var secondMockModule = createModuleStub();
        requireStub.withArgs(firstModuleScriptUrl).returns(firstMockModule);
        requireStub.withArgs(secondModuleScriptUrl).returns(secondMockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(firstMockModule.show.callCount, 1, 'first modules show() method was called');
            assert.equal(secondMockModule.show.callCount, 1, 'second modules show() method was called');
            router.stop();
        });
    });

    it('all modules associated with a page should hide() when navigation away from it', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var firstModuleName = 'myFIRSTCustomModule';
        var firstModuleScriptUrl = 'path/to/first/script';
        var secondModuleName = 'myCustomModule2';
        var secondModuleScriptUrl = 'second/path/to/second/script';
        modulesConfig[firstModuleName] = {
            script: firstModuleScriptUrl
        };
        modulesConfig[secondModuleName] = {
            script: secondModuleScriptUrl
        };
        var pageScriptUrl = 'path/to/page/script';
        pagesConfig[pageUrl] = {
            modules: [
                secondModuleName,
                firstModuleName
            ],
            script: pageScriptUrl
        };
        var secondPageUrl = 'path/to/second/page';
        pagesConfig[secondPageUrl] = {
            script: pageScriptUrl
        };
        var pageHtml = '<div></div>';
        mockPage.getTemplate.returns(Promise.resolve(pageHtml));
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        var firstMockModule = createModuleStub();
        var secondMockModule = createModuleStub();
        requireStub.withArgs(firstModuleScriptUrl).returns(firstMockModule);
        requireStub.withArgs(secondModuleScriptUrl).returns(secondMockModule);
        return router.triggerRoute(pageUrl).then(function () {
            // register first url into window state
            router.history = [{path: pageUrl}];
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(firstMockModule.hide.callCount, 1, 'first modules hide() method was called');
                assert.equal(secondMockModule.hide.callCount, 1, 'second modules hide() method was called');
                router.stop();
            });
        });
    });

    it('navigating back to a previously loaded page, after navigating away, calls page\'s show method again', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var pageScriptUrl = 'path/to/page/script';
        var secondPageScriptUrl = 'second/path/to/page/script';
        pagesConfig[pageUrl] = {
            script: pageScriptUrl
        };
        var secondPageUrl = 'path/to/second/page';
        pagesConfig[secondPageUrl] = {
            script: secondPageScriptUrl
        };
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        var firstPageShowCount = 0;
        return router.triggerRoute(pageUrl).then(function () {
            firstPageShowCount++;
            return router.triggerRoute(secondPageUrl).then(function () {
                return router.triggerRoute(pageUrl).then(function () {
                    firstPageShowCount++;
                    assert.equal(firstMockPage.show.callCount, firstPageShowCount, 'first page show() method was called twice');
                    router.stop();
                });
            });
        });
    });

    it('should call show() on a page that is navigated back to, from a page that fails to load', function () {
        var secondPageUrl = 'my/second/url';
        var firstPageUrl = 'my/real/url';
        var firstPageRouteRegex = '^' + firstPageUrl;
        var secondPageRouteRegex = '^' + secondPageUrl;
        var firstPageScriptUrl = 'path/to/my/script.js';
        var secondPageScriptUrl = 'path/to/my/script2.js';
        var pagesConfig = {};
        pagesConfig[firstPageRouteRegex] = {script: firstPageScriptUrl};
        pagesConfig[secondPageRouteRegex] = {script: secondPageScriptUrl};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var loadPageSpy = sinon.spy(router, 'loadPage');
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptUrl).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        // fail load on second page
        secondMockPage.load.returns(Promise.reject());
        var firstPageShowCallCount = 0;
        return router.triggerRoute(firstPageUrl).then(function () {
            firstPageShowCallCount++;
            return router.triggerRoute(secondPageUrl).catch(function () {
                return router.triggerRoute(firstPageUrl).then(function () {
                    firstPageShowCallCount++;
                    assert.equal(firstMockPage.show.callCount, firstPageShowCallCount, 'first page show() method was called again even after a previous page fails to load');
                    router.stop();
                    loadPageSpy.restore();
                });
            });
        });
    });

    it('should call load() on a page that is requested again after it previously failed to load', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var loadPageSpy = sinon.spy(router, 'loadPage');
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        // fail load call
        mockPage.load.returns(Promise.reject());
        var pageLoadCallCount = 0;
        return router.triggerRoute(pageUrl).catch(function () {
            pageLoadCallCount++;
                return router.triggerRoute(pageUrl).catch(function () {
                    pageLoadCallCount++;
                    assert.equal(mockPage.load.callCount, pageLoadCallCount);
                    router.stop();
                    loadPageSpy.restore();
                });
        });
    });

    it('should resolve the triggerRoute promise but still call a global module\'s error method when global module fails to load', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        // fail global module loading
        var errorObj = {my: 'error'};
        mockModule.load.returns(Promise.reject(errorObj));
        requireStub.returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(mockModule.error.args[0][0], errorObj,  'modules error method was called with error object as first argument');
            router.stop();
        });
    });

    it('loadPage() should NOT reject when a global module fails to load', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleHtml = "<div>my module content</div>";
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var pageHtml = '<div></div>';
        mockPage.getTemplate.returns(Promise.resolve(pageHtml));
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        mockModule.getTemplate.withArgs(moduleTemplateUrl).returns(Promise.resolve(moduleHtml));
        // fail global module loading
        var errorObj = {my: 'error'};
        mockModule.load.returns(Promise.reject(errorObj));
        requireStub.returns(mockModule);
        return router.loadPage(pageUrl).then(function () {
            router.stop();
        });
    });

    it('should allow a global module to finish fetching its data before its show method is called', function (done) {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        // build promise
        var moduleFetchDataPromiseObj = {};
        var moduleFetchDataPromise = new Promise(function (resolve, reject){
            moduleFetchDataPromiseObj.resolve = resolve;
            moduleFetchDataPromiseObj.reject = reject;
        });
        mockModule.fetchData.returns(moduleFetchDataPromise);
        requireStub.returns(mockModule);
        mockPage.show.returns(Promise.resolve());
        var triggerRoutePromise = router.triggerRoute(pageUrl);
        assert.equal(mockModule.show.callCount, 0,  'module show() is not yet called because its data hasnt finished fetching');
        moduleFetchDataPromiseObj.resolve();
        triggerRoutePromise.then(function () {
            assert.equal(mockModule.show.callCount, 1,  'module show() is called after its data is done fetching');
            router.stop();
            done();
        });
    });


    it('should NOT call a global module\'s load() method when page does not specify it', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(mockModule.load.callCount, 0);
            router.stop();
        });
    });

    it('should call show() for a global module on page that has already been visited, after having visited a page without it', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var noGlobalModulePageUrl = 'no/gm';
        pagesConfig[noGlobalModulePageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.show.callCount, 1,  'global modules show() method was called');
            return router.triggerRoute(noGlobalModulePageUrl).then(function () {
                return router.triggerRoute(pageUrl).then(function () {
                    assert.equal(mockModule.show.callCount, 2,  'global modules show() method was called again');
                    router.stop();
                });
            });
        });
    });

    it('hidePage() should call hideGlobalModules() with same path', function () {
        // setup
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var noGlobalModulePageUrl = 'no/gm';
        pagesConfig[noGlobalModulePageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        // build promise
        requireStub.returns(mockModule);
        var hideGlobalModulesStub = sinon.stub(router, 'hidePage').returns(Promise.resolve());
        return router.loadPage(pageUrl).then(function () {
            return router.hidePage(pageUrl).then(function () {
                assert.equal(hideGlobalModulesStub.args[0][0], pageUrl, 'hideGlobalModules() was called with same page url passed to hidePage()');
                hideGlobalModulesStub.restore();
                router.stop();
            });
        });
    });

    it('should call hide on a global module on a previous page if the new page does not have it', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig['^' + pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var noGlobalModulePageUrl = 'no/gm';
        pagesConfig['^' + noGlobalModulePageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.hide.callCount, 0);
            mockModule.active = true;
            return router.triggerRoute(noGlobalModulePageUrl).then(function () {
                assert.equal(mockModule.hide.callCount, 1);
                router.stop();
            });
        });
    });

    it('hideGlobalModules() should NOT call hide on a global module on a previous page if the new page has it', function () {
        var pageUrl = 'my/page/url';
        var secondPageUrl = 'my/page/url2';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        pagesConfig[secondPageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(mockModule.hide.callCount, 0);
                router.stop();
            });
        });
    });

    it('should call hide on a global module on a previous page if the new page does not have it but has other global modules specified', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig['^' + pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var noGlobalModulePageUrl = 'no/gm';
        pagesConfig['^' + noGlobalModulePageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl,
            modules: []
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.hide.callCount, 0);
            mockModule.active = true;
            return router.triggerRoute(noGlobalModulePageUrl).then(function () {
                assert.equal(mockModule.hide.callCount, 1);
                router.stop();
            });
        });
    });

    it('should NOT call hide on a global module on a previous page if the new page does not have it and it is not active', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig['^' + pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var noGlobalModulePageUrl = 'no/gm';
        pagesConfig['^' + noGlobalModulePageUrl] = {
            template: pageTemplateUrl,
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.hide.callCount, 0);
            mockModule.active = false;
            return router.triggerRoute(noGlobalModulePageUrl).then(function () {
                assert.equal(mockModule.hide.callCount, 0);
                router.stop();
            });
        });
    });

    it('getPageConfigByPath() should return the config of the first matching page if more than one regex match exists', function () {
        var pageUrl = 'my/page/url';
        var firstPageUrlRegex = pageUrl + '';
        var secondPageUrlRegex = pageUrl + '/?'; // optional slash
        var pagesConfig = {};
        var modulesConfig = {};
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[firstPageUrlRegex] = {
            template: pageTemplateUrl,
            script: pageScriptUrl,
            test: '1'
        };
        // add second matching page config
        pagesConfig[secondPageUrlRegex] = {
            template: pageTemplateUrl,
            script: pageScriptUrl,
            test: '2'
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        assert.deepEqual(router.getPageConfigByPath(pageUrl), pagesConfig[firstPageUrlRegex]);
        router.stop();
    });

    it('loadPage() should load the first matching page if more than one page matches the url passed to triggerRoute()', function () {
        // setup
        var pageUrl = 'my/page/url';
        var firstPageUrlRegex = pageUrl + '';
        var secondPageUrlRegex = pageUrl + '/?'; // optional slash
        var pagesConfig = {};
        var modulesConfig = {};
        var pageScriptUrl = 'path/to/page/script';
        var secondPageScriptUrl = 'path/to/page/script2';
        pagesConfig[firstPageUrlRegex] = {
            script: pageScriptUrl
        };
        // add second matching page config
        pagesConfig[secondPageUrlRegex] = {
            script: secondPageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var firstMockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(firstMockPage);
        var secondMockPage = createPageStub();
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(firstMockPage.load.callCount, 1, 'first matching page was loaded');
            assert.deepEqual(secondMockPage.load.callCount, 0, 'second matching page was NOT loaded');
            router.stop();
        });
    });

    it('should pass the data property that has replaced reference group of the matching route config of the url requested to the associated page\'s loadScript call', function () {
        var pageUrlRegex = '^profile/([0-9]+)$';
        var pagesConfig = {};
        var dataBaseUrl = 'http://localhost:8888/profile';
        var dataUrl = dataBaseUrl + '/$1';
        var pageScriptPath = 'path/to/my/page/script';
        pagesConfig[pageUrlRegex] = {data: dataUrl, script: pageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptPath).returns(pageConstructorStub);
        router.start();
        var profileNum = '32';
        return router.triggerRoute('profile/' + profileNum).then(function () {
            assert.equal(pageConstructorStub.args[0][1].data, dataBaseUrl + '/' + profileNum);
            router.stop();
        });
    });

    it('should pass the data property that has replaced reference group of the matching route config of the slash-prefixed url requested to the associated page\'s loadScript call', function () {
        var pageUrlRegex = '^profile/([0-9]+)$';
        var pagesConfig = {};
        var dataBaseUrl = 'http://localhost:8888/profile';
        var dataUrl = dataBaseUrl + '/$1';
        var pageScriptPath = 'path/to/my/page/script';
        pagesConfig[pageUrlRegex] = {data: dataUrl, script: pageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptPath).returns(pageConstructorStub);
        router.start();
        var profileNum = '32';
        return router.triggerRoute('/profile/' + profileNum).then(function () {
            assert.equal(pageConstructorStub.args[0][1].data, dataBaseUrl + '/' + profileNum);
            router.stop();
        });
    });

    it('should load another Page instance with the same data for a subsequent trigger to a route that matches the regex capture group in the page config', function (done) {
        var pageUrlRegex = '^profile/([0-9]+)$';
        var pagesConfig = {};
        var dataBaseUrl = 'http://localhost:8888/profile';
        var dataUrl = dataBaseUrl + '/$1';
        // need to declare script to ensure requireStub runs
        pagesConfig[pageUrlRegex] = {data: dataUrl, script: 'my/page/js'};
        var router = new Router({pagesConfig: pagesConfig});
        var firstMockPage = createPageStub();
        var firstMockPageConstructor = sinon.stub().returns(firstMockPage);
        requireStub.onFirstCall().returns(firstMockPageConstructor);
        var secondMockPage = createPageStub();
        var secondMockPageConstructor = sinon.stub().returns(secondMockPage);
        requireStub.onSecondCall().returns(secondMockPageConstructor);
        router.start();
        router.triggerRoute('profile/33').then(function () {
            assert.equal(firstMockPageConstructor.args[0][1].data, dataBaseUrl + '/33');
            router.triggerRoute('profile/44').then(function () {
                assert.equal(secondMockPageConstructor.args[0][1].data, dataBaseUrl + '/44');
                router.stop();
                done();
            });
        });
    });

    it('should set a page-identifying css class onto page\'s element when loaded', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.ok(pagesContainer.children[0].classList.contains('page'));
            router.stop();
        });
    });

    it('should set the css class passed via customPageClass onto page\'s element when loaded', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        var customClass = 'my-custom-class';
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl, customPageClass: customClass};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.ok(pagesContainer.children[0].classList.contains(customClass));
            router.stop();
        });
    });

    it('should set multiple css classes passed via customPageClass onto page\'s element when loaded', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        var firstCustomClass = 'my-custom-class';
        var secondCustomClass  = 'my-second-class';
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl, customPageClass: firstCustomClass + ' ' + secondCustomClass};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.ok(pagesContainer.children[0].classList.contains(firstCustomClass));
            assert.ok(pagesContainer.children[0].classList.contains(secondCustomClass));
            router.stop();
        });
    });

    it('should pass correct page default css classes when a page is loaded', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var loadPageSpy = sinon.spy(router, 'loadPage');
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        assert.equal(pageConstructorStub.callCount, 0);
        return router.triggerRoute(pageUrl).then(function () {
            var initializeOptions = pageConstructorStub.args[0][1];
            assert.equal(initializeOptions.activeClass, 'page-active');
            assert.equal(initializeOptions.loadedClass, 'page-loaded');
            assert.equal(initializeOptions.disabledClass, 'page-disabled');
            assert.equal(initializeOptions.errorClass, 'page-error');
            router.stop();
            loadPageSpy.restore();
        });
    });

    it('should pass requestOptions config option in Router\'s constructor to Page constructor when page is loaded', function () {
        var pageUrl = 'my/real/url';
        var pageRouteRegex = '^' + pageUrl;
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {};
        pagesConfig[pageRouteRegex] = {script: pageScriptUrl};
        var testRequestOptions = {my: 'options'};
        var router = new Router({pagesConfig: pagesConfig, requestOptions: testRequestOptions});
        router.start();
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        assert.equal(pageConstructorStub.callCount, 0);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(pageConstructorStub.args[0][1].requestOptions, testRequestOptions);
            router.stop();
        });
    });

    it('should pass requestOptions option in module config to Module constructor when a module is loaded', function () {
        var moduleScriptUrl = 'my/custom/module';
        var pageScriptUrl = 'path/to/my/script.js';
        var testRequestOptions = {my: 'options'};
        var modulesConfig = {
            myModule: {
                script: moduleScriptUrl,
                requestOptions: testRequestOptions
            }
        };
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl,
                modules: ['myModule']
            }
        };
        var router = new Router({pagesConfig: pagesConfig, modulesConfig: modulesConfig});
        router.start();
        var mockModule = createModuleStub();
        var mockConstructorStub = sinon.stub().returns(mockModule);
        requireStub.withArgs(moduleScriptUrl).returns(mockConstructorStub);
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        assert.equal(mockConstructorStub.callCount, 0);
        return router.triggerRoute('my/real/url').then(function () {
            assert.deepEqual(mockConstructorStub.args[0][1].requestOptions, testRequestOptions);
            router.stop();
        });
    });

    it('should pass requestOptions option in page config to Page constructor when page is loaded', function () {
        var pageScriptUrl = 'path/to/my/script.js';
        var testRequestOptions = {my: 'options'};
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl,
                requestOptions: testRequestOptions
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        assert.equal(pageConstructorStub.callCount, 0);
        return router.triggerRoute('my/real/url').then(function () {
            assert.deepEqual(pageConstructorStub.args[0][1].requestOptions, testRequestOptions);
            router.stop();
        });
    });

    it('should merge requestOptions option in module config to Module constructor with requestOption in Page level config when a module is loaded', function () {
        var moduleScriptUrl = 'my/custom/module';
        var pageScriptUrl = 'path/to/my/script.js';
        var testRequestOptions = {myModule: 'options'};
        var modulesConfig = {
            myModule: {
                script: moduleScriptUrl,
                requestOptions: testRequestOptions
            }
        };
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl,
                modules: ['myModule']
            }
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig,
            requestOptions: {r: 'requestOpts'}

        });
        router.start();
        var mockModule = createModuleStub();
        var mockConstructorStub = sinon.stub().returns(mockModule);
        requireStub.withArgs(moduleScriptUrl).returns(mockConstructorStub);
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        assert.equal(mockConstructorStub.callCount, 0);
        return router.triggerRoute('my/real/url').then(function () {
            assert.equal(mockConstructorStub.args[0][1].requestOptions.r, 'requestOpts');
            assert.equal(mockConstructorStub.args[0][1].requestOptions.myModule, 'options');
            router.stop();
        });
    });

    it('should prevent default on any HTMLAnchorElement inside of the requested page element and pass the HTMLAnchorElement\'s href attribute to triggerRoute call', function () {
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var link = document.createElement('a');
        var linkTo = 'jkl';
        link.setAttribute('href', linkTo);
        var mockPage = createPageStub();
        mockPage.el = document.createElement('div');
        mockPage.el.appendChild(link);
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        assert.equal(pageConstructorStub.callCount, 0);
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        var triggerRouteCallCount = 0;
        return router.triggerRoute('my/real/url').then(function () {
            triggerRouteCallCount++;
            var linkEvent = new Event('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true
            });
            link.dispatchEvent(linkEvent);
            assert.ok(linkEvent.defaultPrevented);
            assert.equal(triggerRouteSpy.args[triggerRouteCallCount][0], linkTo);
            router.stop();
        });
    });

    it('should NOT trigger a new route when clicking on page\'s HTMLAnchorElement\'s after another route is triggered', function () {
        var pageScriptUrl = 'path/to/my/script.js';
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl
            },
            '^my/other/url': {}
        };
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var link = document.createElement('a');
        link.setAttribute('href', 'djley/sj'); // prevent url from loading a new page when testing
        var mockPage = createPageStub();
        mockPage.el = document.createElement('div');
        mockPage.el.appendChild(link);
        var pageConstructorStub = sinon.stub().returns(mockPage);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        assert.equal(pageConstructorStub.callCount, 0);
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        var triggerRouteCallCount = 0;
        return router.triggerRoute('my/real/url').then(function () {
            triggerRouteCallCount++;
            return router.triggerRoute('my/other/url').then(function () {
            triggerRouteCallCount++;
                var linkEvent = new Event('click', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                });
                linkEvent.preventDefault();
                var linkPreventDefaultSpy = sinon.spy(linkEvent, 'preventDefault');
                link.dispatchEvent(linkEvent);
                assert.equal(linkPreventDefaultSpy.callCount, 0);
                assert.equal(triggerRouteSpy.callCount, triggerRouteCallCount);
                router.stop();
            });
        });
    });

    it('should prevent default of nested global module HTMLAnchorElements and trigger a new route when on a route that has the global module assigned', function () {
        var pageScriptUrl = 'path/to/my/script.js';
        var globalModuleScriptPath = 'path/to/global/module.js';
        var modulesConfig = {
            myCustomModule: {
                script: globalModuleScriptPath,
                global: true
            }
        };
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl,
                modules: ['myCustomModule']
            },
            '^my/other/url': {}
        };
        var router = new Router({pagesConfig: pagesConfig, modulesConfig: modulesConfig});
        router.start();
        var link = document.createElement('a');
        link.setAttribute('href', 'blah.com/lb'); // prevent url from loading a new page when testing
        windowStub.returns(windowMock);
        var mockPage = createPageStub();
        var mockGlobalModule = createModuleStub();
        mockGlobalModule.el = document.createElement('div');
        mockGlobalModule.el.appendChild(link);
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(globalModuleScriptPath).returns(mockGlobalModule);
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        var triggerRouteCallCount = 0;
        return router.triggerRoute('my/real/url').then(function () {
            triggerRouteCallCount++;
            var linkEvent = new Event('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true
            });
            link.dispatchEvent(linkEvent);
            triggerRouteCallCount++;
            assert.ok(linkEvent.defaultPrevented);
            assert.equal(triggerRouteSpy.callCount, triggerRouteCallCount);
            router.stop();
        });
    });

    it('should NOT prevent default of nested global module HTMLAnchorElements nor trigger a new route when on a route of which does not have the global module assigned', function () {
        var pageScriptUrl = 'path/to/my/script.js';
        var globalModuleScriptPath = 'path/to/global/module.js';
        var modulesConfig = {
            myCustomModule: {
                script: globalModuleScriptPath,
                global: true
            }
        };
        var pagesConfig = {
            '^my/real/url': {
                script: pageScriptUrl,
                modules: ['myCustomModule']
            },
            '^my/other/url': {}
        };
        var router = new Router({pagesConfig: pagesConfig, modulesConfig: modulesConfig});
        router.start();
        var link = document.createElement('a');
        link.setAttribute('href', '#'); // prevent url from loading a new page when testing
        var mockPage = createPageStub();
        var mockGlobalModule = createModuleStub();
        mockGlobalModule.el = document.createElement('div');
        mockGlobalModule.el.appendChild(link);
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(globalModuleScriptPath).returns(mockGlobalModule);
        var triggerRouteSpy = sinon.spy(router, 'triggerRoute');
        var triggerRouteCallCount = 0;
        return router.triggerRoute('my/real/url').then(function () {
            triggerRouteCallCount++;
            return router.triggerRoute('my/other/url').then(function () {
                triggerRouteCallCount++;
                var linkEvent = new Event('click', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                });
                link.dispatchEvent(linkEvent);
                assert.ok(!linkEvent.defaultPrevented);
                assert.equal(triggerRouteSpy.callCount, triggerRouteCallCount);
                router.stop();
            });
        });
    });

    it('should resolve the triggerRoute promise and call the onRouteError callback option when there is no config setup for a requested route', function () {
        var errorSpy = sinon.spy();
        var router = new Router({onRouteError: errorSpy});
        router.start();
        var mockPage = createPageStub();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        assert.equal(pageConstructorStub.callCount, 0);
        return router.triggerRoute('my/real/url').then(function () {
            var assertError = errorSpy.args[0][0];
            assert.deepEqual(assertError.constructor, Error);
            assert.ok(errorSpy.calledOn(router));
            router.stop();
        });
    });

    it('should NOT destroy global modules if currently on a route that requires them after reset() is called', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.destroy.callCount, 0);
            router.reset();
            assert.equal(mockModule.destroy.callCount, 0);
            router.stop();
        });
    });

    it('should NOT destroy the current page after reset() is called', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockPage.destroy.callCount, 0);
            router.reset();
            assert.equal(mockPage.destroy.callCount, 0);
            router.stop();
        });
    });

    it('should destroy all other previous pages and remove their els from the DOM when reset() is called', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(firstMockPage.destroy.callCount, 0);
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(firstMockPage.destroy.callCount, 0);
                router.reset();
                assert.equal(pagesContainer.children.length, 1, 'one child left which the current pages el');
                assert.equal(firstMockPage.destroy.callCount, 1);
                router.stop();
            });
        });
    });

    it('should destroy all other global modules when reset() is called if the page on which it was called does not have any designated', function () {
        var pageUrl = 'my/page/url';
        var globalModuleScriptPath = 'my/global/module';
        var modulesConfig = {
            globalModule: {script: globalModuleScriptPath, global: true}
        };
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath, modules: ['globalModule']};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, modulesConfig: modulesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        var globalModule = createModuleStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        requireStub.withArgs(globalModuleScriptPath).returns(globalModule);
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(globalModule.destroy.callCount, 0);
                router.reset();
                assert.equal(globalModule.destroy.callCount, 1);
                router.stop();
            });
        });
    });

    it('should load global modules again after they\'ve been destroyed due to a previous reset() being called', function () {
        var pageUrl = 'my/page/url';
        var globalModuleScriptPath = 'my/global/module';
        var modulesConfig = {
            globalModule: {script: globalModuleScriptPath, global: true}
        };
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath, modules: ['globalModule']};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, modulesConfig: modulesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var globalModule = createModuleStub();
        requireStub.withArgs(globalModuleScriptPath).returns(globalModule);
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(globalModule.load.callCount, 1);
                router.reset();
                var secondGlobalModuleInstance = createModuleStub();
                requireStub.withArgs(globalModuleScriptPath).returns(secondGlobalModuleInstance);
                return router.triggerRoute(pageUrl).then(function () {
                    assert.equal(globalModule.load.callCount, 1);
                    assert.equal(secondGlobalModuleInstance.load.callCount, 1);
                    router.stop();
                });
            });
        });
    });

    it('should load all previous pages a second time after reset() is called', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var firstPageLoadCallCount = 0;
        return router.triggerRoute(pageUrl).then(function () {
            firstPageLoadCallCount++;
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(firstMockPage.load.callCount, firstPageLoadCallCount);
                router.reset();
                return router.triggerRoute(pageUrl).then(function () {
                    firstPageLoadCallCount++;
                    assert.equal(firstMockPage.load.callCount, firstPageLoadCallCount);
                    router.stop();
                });
            });
        });
    });

    it('should load a previous page a second time if it failed on the first load', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var firstPageLoadCallCount = 0;
        firstMockPage.load.returns(Promise.reject());
        return router.triggerRoute(pageUrl).then(function () {
            firstPageLoadCallCount++;
            // must trigger another page to ensure load gets called again
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.equal(firstMockPage.load.callCount, firstPageLoadCallCount);
                firstMockPage.load.returns(Promise.resolve());
                return router.triggerRoute(pageUrl).then(function () {
                    firstPageLoadCallCount++;
                    assert.equal(firstMockPage.load.callCount, firstPageLoadCallCount);
                    router.stop();
                });
            });
        });
    });

    it('should trigger onRouteError callback option if the page script that loaded produces a syntax error', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var pageScriptUrl = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: pageScriptUrl};
        var onErrorSpy = sinon.spy();
        var router = new Router({pagesConfig: pagesConfig, onRouteError: onErrorSpy});
        router.start();
        var pageConstructorStub = sinon.stub().returns(mockPage);
        var syntaxError = new Error('SyntaxError');
        // make stack an empty string so doesnt trigger any
        // inadvertent behavior or reaction from test runner
        syntaxError.stack = '';
        pageConstructorStub.throws(syntaxError);
        requireStub.withArgs(pageScriptUrl).returns(pageConstructorStub);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(onErrorSpy.args[0][0], syntaxError);
            router.stop();
        });
    });

    it('should NOT trigger a route error if there are existing subModules on a page that do not implement the Module interface', function () {
        var moduleScriptUrl = 'my/custom/module';
        var pageScriptUrl = 'path/to/my/script.js';
        var routerErrorSpy = sinon.spy();
        var router = new Router({
            pagesConfig: {
                '^my/real/url': {script: pageScriptUrl, modules: ['myModule']}
            },
            modulesConfig: {
                myModule: {script: moduleScriptUrl}
            },
            onRouteError: routerErrorSpy
        });
        router.start();
        var mockModule = function() {};
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute('my/real/url').then(function () {
            assert.equal(routerErrorSpy.callCount, 0);
            router.stop();
        });
    });

    it('should NOT trigger a route error when hiding a page if there are existing subModules on it that do not implement the Module interface', function () {
        var moduleScriptUrl = 'my/custom/module';
        var firstPageScriptPath = 'path/to/my/script.js';
        var secondPageScriptPath = 'second/path/to/second/script';
        var routerErrorSpy = sinon.spy();
        var router = new Router({
            pagesConfig: {
                '^page/with/module': {script: firstPageScriptPath, modules: ['myModule']},
                '^page/without/module': {script: secondPageScriptPath}
            },
            modulesConfig: {
                myModule: {script: moduleScriptUrl}
            },
            onRouteError: routerErrorSpy
        });
        router.start();
        requireStub.withArgs(firstPageScriptPath).returns(createPageStub());
        requireStub.withArgs(secondPageScriptPath).returns(createPageStub());
        var mockModule = function() {};
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute('page/with/module').then(function () {
            // trigger another page without the module to ensure its hide() method gets called
            return router.triggerRoute('page/without/module').then(function () {
                assert.equal(routerErrorSpy.callCount, 0);
                router.stop();
            });
        });
    });

    it('should NOT trigger a route error when showing and hiding global modules that do not implement the Module interface', function () {
        var moduleScriptUrl = 'my/custom/module';
        var firstPageScriptPath = 'path/to/my/script.js';
        var secondPageScriptPath = 'second/path/to/second/script';
        var routerErrorSpy = sinon.spy();
        var router = new Router({
            pagesConfig: {
                '^page/with/module': {script: firstPageScriptPath, modules: ['myModule']},
                '^page/without/module': {script: secondPageScriptPath}
            },
            modulesConfig: {
                myModule: {script: moduleScriptUrl, global: true}
            },
            onRouteError: routerErrorSpy
        });
        router.start();
        requireStub.withArgs(firstPageScriptPath).returns(createPageStub());
        requireStub.withArgs(secondPageScriptPath).returns(createPageStub());
        var mockModule = function() {};
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute('page/with/module').then(function () {
            // trigger another page without the module to ensure its hide() method gets called
            return router.triggerRoute('page/without/module').then(function () {
                assert.equal(routerErrorSpy.callCount, 0);
                router.stop();
            });
        });
    });

    it('should destroy global module if its key is passed to resetGlobalModule()', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.destroy.callCount, 0);
            router.resetGlobalModule(moduleName);
            assert.equal(mockModule.destroy.callCount, 1);
            router.stop();
        });
    });

    it('should destroy global module if an array with its key is passed to resetGlobalModule()', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockModule.destroy.callCount, 0);
            router.resetGlobalModule([moduleName]);
            assert.equal(mockModule.destroy.callCount, 1);
            router.stop();
        });
    });

    it('should destroy a page if resetPage() is passed the page\'s path', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockPage.destroy.callCount, 0);
            router.resetPage(pageUrl);
            assert.equal(mockPage.destroy.callCount, 1);
            router.stop();
        });
    });

    it('should destroy a page if resetPage() is passed an array containing the page\'s path', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.equal(mockPage.destroy.callCount, 0);
            router.resetPage([pageUrl]);
            assert.equal(mockPage.destroy.callCount, 1);
            router.stop();
        });
    });

    it('should call the page\'s hide method when it is navigated away from although it has been triggered with triggerUrlChange set to false', function () {
        var firstPageScriptPath = 'path/to/my/script.js';
        var secondPageScriptPath = 'second/path/to/second/script';
        var routerErrorSpy = sinon.spy();
        var router = new Router({
            pagesConfig: {
                '^page/1': {script: firstPageScriptPath},
                '^page/2': {script: secondPageScriptPath}
            },
            onRouteError: routerErrorSpy
        });
        router.start();
        var firstPage = createPageStub();
        var secondPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondPage);
        assert.equal(firstPage.hide.callCount, 0);
        return router.triggerRoute('page/1', {triggerUrlChange: false}).then(function () {
            assert.equal(firstPage.hide.callCount, 0);
            return router.triggerRoute('page/2').then(function () {
                assert.equal(firstPage.hide.callCount, 1);
                router.stop();
            });
        });
    });

    it('should pass "el" specified in a global module to the Module constructor', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        var globalModuleElement = document.createElement('div');
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            el: globalModuleElement,
            global: true
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var mockPage = createPageStub();
        var mockModule = createModuleStub();
        var mockModuleConstructor = sinon.stub().returns(mockModule);
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModuleConstructor);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(mockModuleConstructor.args[0][0], globalModuleElement);
            router.stop();
        });
    });

    it('should add the page\'s el from the DOM when navigating to a page', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        return router.triggerRoute(pageUrl).then(function () {
            assert.ok(pagesContainer.contains(firstMockPage.el));
            router.stop();
        });
    });

    it('should remove the page\'s el from the DOM when navigating away from a page', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                assert.ok(!pagesContainer.contains(firstMockPage.el));
                router.stop();
            });
        });
    });

    it('should inject the same page el from the DOM that was removed when navigating back to a previously hidden page', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var secondPageUrl = 'path/to/second/page';
        var secondPageScriptPath = 'second/path/to/second/script';
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        return router.triggerRoute(pageUrl).then(function () {
            return router.triggerRoute(secondPageUrl).then(function () {
                return router.triggerRoute(pageUrl).then(function () {
                    assert.ok(pagesContainer.contains(firstMockPage.el));
                    router.stop();
                });
            });
        });
    });

    it('should call a page\'s show() method when showPage() is called but only after at least 5 milliseconds have passed', function (done) {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var pagesContainer = document.createElement('div');
        var router = new Router({pagesConfig: pagesConfig, pagesContainer: pagesContainer});
        router.start();
        var firstMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        // must load page to register it to pagesMaps
        router.loadPage(pageUrl).then(() => {
            router.showPage(pageUrl);
            assert.equal(firstMockPage.show.callCount, 0);
            setTimeout(() => {
                assert.equal(firstMockPage.show.callCount, 1);
                router.stop();
                done();
            }, 6)
        });
    });

    it('should pass options specified in a global module to the Module\'s constructor when going to a page where it has been assigned', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        var customModuleOptions = {test: 'my option'};
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl,
            options: customModuleOptions
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var mockPage = createPageStub();
        var mockModule = createModuleStub();
        var mockModuleConstructor = sinon.stub().returns(mockModule);
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModuleConstructor);
        return router.triggerRoute(pageUrl).then(function () {
            assert.deepEqual(mockModuleConstructor.args[0][1].test, 'my option');
            router.stop();
        });
    });

    it('should append the module\'s el to the page\'s el when navigating to a page that contains it', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var modulesConfig = {};
        var moduleName = 'customModule';
        var moduleScriptUrl = 'path/to/module/script';
        var moduleTemplateUrl = 'url/to/my/template';
        modulesConfig[moduleName] = {
            template: moduleTemplateUrl,
            script: moduleScriptUrl
        };
        var pageScriptUrl = 'path/to/page/script';
        var pageTemplateUrl = 'url/to/my/template';
        pagesConfig[pageUrl] = {
            template: pageTemplateUrl,
            modules: [moduleName],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var mockPage = createPageStub();
        var mockModule = createModuleStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(moduleScriptUrl).returns(mockModule);
        return router.triggerRoute(pageUrl).then(function () {
            assert.ok(mockPage.el.contains(mockModule.el));
            router.stop();
        });
    });

    it('should append multiple module\'s el to the page\'s el in the order in which they are specified in the configuration when navigating to a page that contains them (before modules are loaded)', function (done) {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstModuleScriptPath = 'path/to/module/script';
        var secondModuleScriptPath = 'path/to/second/module/script';
        var modulesConfig = {
            firstModule: {
                script: firstModuleScriptPath
            },
            secondModule: {
                script: secondModuleScriptPath
            }
        };
        var pageScriptUrl = 'path/to/page/script';
        pagesConfig[pageUrl] = {
            modules: ['firstModule', 'secondModule'],
            script: pageScriptUrl
        };
        var router = new Router({
            pagesConfig: pagesConfig,
            modulesConfig: modulesConfig
        });
        router.start();
        var mockPage = createPageStub();
        // ensure test passes even when module's load calls are not resolved
        var firstMockModule = createModuleStub();
        firstMockModule.load.returns(new Promise(function () {}));
        var secondMockModule = createModuleStub();
        secondMockModule.load.returns(new Promise(function () {}));
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        requireStub.withArgs(firstModuleScriptPath).returns(firstMockModule);
        requireStub.withArgs(secondModuleScriptPath).returns(secondMockModule);
        router.triggerRoute(pageUrl);
        _.defer(function () {
            assert.equal(mockPage.el.children[0], firstMockModule.el);
            assert.equal(mockPage.el.children[1], secondMockModule.el);
            router.stop();
            done();
        });
    });

    it('should change the document\'s title to the value set as the "title" in the configuration for a page when loaded', function () {
        var mockDocument = {title: 'blah'};
        var pageScriptUrl = 'path/to/page/script';
        var pageTitle = 'My page title';
        var pagesConfig = {
            'my/page/url': {
                script: pageScriptUrl,
                title: pageTitle
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        Object.defineProperty(router, 'document', {
            get: function () {
                return mockDocument;
            }
        });
        router.start();
        var mockPage = createPageStub();
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute('my/page/url').then(function () {
            assert.equal(mockDocument.title, pageTitle);
            router.stop();
        });
    });

    it('should change the document\'s title to the value set as the "title" getter in the configuration for a page when loaded', function () {
        var mockDocument = {title: 'blah'};
        var pageScriptUrl = 'path/to/page/script';
        var pageTitle = 'My page title';
        var pagesConfig = {
            'my/page/url': {
                script: pageScriptUrl
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        Object.defineProperty(router, 'document', {
            get: function () {
                return mockDocument;
            }
        });
        router.start();
        var mockPage = createPageStub();
        mockPage.title = pageTitle;
        requireStub.withArgs(pageScriptUrl).returns(mockPage);
        return router.triggerRoute('my/page/url').then(function () {
            assert.equal(mockDocument.title, pageTitle);
            router.stop();
        });
    });

    it('should change the document\'s title back to the original value when start was called when visiting a page that does not have a custom title after coming from a page that did have one', function () {
        var firstPageScriptUrl = 'path/to/page/script';
        var secondPageScriptUrl = 'path/to/page2/script';
        var pagesConfig = {
            'my/page/url': {
                script: firstPageScriptUrl,
                title: 'My custom title'
            },
            'my/second/page/url': {
                script: secondPageScriptUrl
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        var mockDocument = {title: 'originalTitle'};
        Object.defineProperty(router, 'document', {
            get: function () {
                return mockDocument;
            }
        });
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptUrl).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        return router.triggerRoute('my/page/url').then(function () {
            return router.triggerRoute('my/second/page/url').then(function () {
                assert.equal(mockDocument.title, 'originalTitle');
                router.stop();
            });
        });
    });

    it('should change the document\'s title back to the custom title when re-visiting a page for a second time', function () {
        var firstPageScriptUrl = 'path/to/page/script';
        var secondPageScriptUrl = 'path/to/page2/script';
        var pagesConfig = {
            'my/page/url': {
                script: firstPageScriptUrl,
                title: 'My custom title'
            },
            'my/second/page/url': {
                script: secondPageScriptUrl
            }
        };
        var router = new Router({pagesConfig: pagesConfig});
        var mockDocument = {title: 'originalTitle'};
        Object.defineProperty(router, 'document', {
            get: function () {
                return mockDocument;
            }
        });
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptUrl).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptUrl).returns(secondMockPage);
        return router.triggerRoute('my/page/url').then(function () {
            return router.triggerRoute('my/second/page/url').then(function () {
                return router.triggerRoute('my/page/url').then(function () {
                    assert.equal(mockDocument.title, 'My custom title');
                    router.stop();
                });
            });
        });
    });

    it('should pass triggerRoute options data into the second argument of the associated page constructor', function () {
        var pageUrl = 'my/page/url';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var pageConstructor = sinon.stub().returns(firstMockPage);
        requireStub.withArgs(firstPageScriptPath).returns(pageConstructor);
        var testData = {my: 'data'};
        return router.triggerRoute(pageUrl, {data: testData}).then(() => {
            assert.deepEqual(pageConstructor.args[0][1].data, testData);
            router.stop();
        });
    });

    it('should call resetPage with the requested route if has been previously accessed with different data that what was passed as triggerRoute options data', function () {

        var pageUrl = 'my/page/url';
        var secondPageUrl = 'my/page/url/two';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        var secondPageScriptPath = 'path/to/page/script/two';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var resetPageSpy = sinon.spy(router, 'resetPage');
        var testData = {my: 'data'};
        return router.triggerRoute(pageUrl).then(() => {
            assert.equal(resetPageSpy.callCount, 0);
            // trigger another page to change current url so our previous url will load again
            return router.triggerRoute(secondPageUrl).then(() => {
                assert.equal(resetPageSpy.callCount, 0);
                firstMockPage.options = {};
                return router.triggerRoute(pageUrl, {data: testData}).then(() => {
                    assert.equal(resetPageSpy.args[0][0], pageUrl);
                    router.stop();
                });
            });
        });

    });

    it('should call page\'s load method a second time if a set of options data is passed into triggerRoute for first time', function () {
        var pageUrl = 'my/page/url';
        var secondPageUrl = 'my/page/url/second';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        var secondPageScriptPath = 'path/to/page/script/two';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var testData = {my: 'data'};
        return router.triggerRoute(pageUrl).then(() => {
            assert.equal(firstMockPage.load.callCount, 1);
            // trigger another page to change current url so our previous url will load again
            return router.triggerRoute(secondPageUrl).then(() => {
                assert.equal(firstMockPage.load.callCount, 1);
                firstMockPage.options = {};
                return router.triggerRoute(pageUrl, {data: testData}).then(() => {
                    assert.equal(firstMockPage.load.callCount, 2);
                    router.stop();
                });
            });
        });
    });

    it('should not call load() a second time if the same set of options data is passed into triggerRoute', function () {
        var pageUrl = 'my/page/url';
        var secondPageUrl = 'my/page/url/second';
        var pagesConfig = {};
        var firstPageScriptPath = 'path/to/page/script';
        var secondPageScriptPath = 'path/to/page/script/two';
        pagesConfig[pageUrl] = {script: firstPageScriptPath};
        pagesConfig[secondPageUrl] = {script: secondPageScriptPath};
        var router = new Router({pagesConfig: pagesConfig});
        router.start();
        var firstMockPage = createPageStub();
        var secondMockPage = createPageStub();
        requireStub.withArgs(firstPageScriptPath).returns(firstMockPage);
        requireStub.withArgs(secondPageScriptPath).returns(secondMockPage);
        var testData = {my: 'data'};
        return router.triggerRoute(pageUrl, {data: testData}).then(() => {
            // mock options data on page level
            firstMockPage.options = {data: testData};
            assert.equal(firstMockPage.load.callCount, 1);
            // trigger another page to change current url so our previous url will load again
            return router.triggerRoute(secondPageUrl).then(() => {
                assert.equal(firstMockPage.load.callCount, 1);
                return router.triggerRoute(pageUrl, {data: testData}).then(() => {
                    assert.equal(firstMockPage.load.callCount, 1);
                    router.stop();
                });
            });
        });
    });

});
