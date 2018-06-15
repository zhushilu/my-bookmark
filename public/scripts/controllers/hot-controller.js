app.controller('hotCtr', ['$scope', '$state', '$stateParams', '$filter', '$window', '$timeout', '$document', 'ngDialog', 'bookmarkService', 'pubSubService', 'dataService', function($scope, $state, $stateParams, $filter, $window, $timeout, $document, ngDialog, bookmarkService, pubSubService, dataService) {
    console.log("Hello hotCtr...");

    $scope.hoverBookmark = null;
    $scope.bookmarks = []; // 书签数据
    $scope.bookmarkNormalHover = false;
    $scope.bookmarkEditHover = false;
    const perPageItems = 20;
    $scope.totalPages = 0;
    $scope.currentPage = 1;
    $scope.inputPage = '';
    $scope.loadBusy = false;
    $scope.curDay = 0;
    $scope.toastrId = 0;
    $scope.random = 0;

    bookmarkService.autoLogin()
        .then((data) => {
            var login = data.logined;
            var index = login ? dataService.LoginIndexHot : dataService.NotLoginIndexHot;
            pubSubService.publish('Common.menuActive', {
                login: login,
                index: index
            });
        })
        .catch((err) => {
            console.log('autoLogin err', err)
        });

    getHotBookmarks();

    $scope.jumpToUrl = function(url) {
        $window.open(url, '_blank');
    }

    $scope.favoriteBookmark = function(b) {
        var menusScope = $('div[ng-controller="menuCtr"]').scope();
        var login = (menusScope && menusScope.login) || false;
        if (!login) {
            $scope.toastrId = toastr.info('请先登录再收藏书签！', "提示");
            return;
        }

        var bookmark = {}
        bookmark.description = '';
        bookmark.title = b.title;
        bookmark.url = b.url;
        bookmark.public = 1;
        bookmark.click_count = 1;

        bookmarkService.favoriteBookmark(bookmark)
            .then((data) => {
                pubSubService.publish('EditCtr.inserBookmarsSuccess', data);
                if (data.title) {
                    toastr.success('[ ' + data.title + ' ] 收藏成功！', "提示");
                } else {
                    toastr.error('[ ' + bookmark.title + ' ] 收藏失败！', "提示");
                }
            })
            .catch((err) => {
                toastr.error('[ ' + bookmark.title + ' ] 收藏失败，' + JSON.stringify(err), "提示");
            });
    }

    $scope.storeBookmark = function(bookmark) {
        var menusScope = $('div[ng-controller="menuCtr"]').scope();
        var login = (menusScope && menusScope.login) || false;
        if (!login) {
            $scope.toastrId = toastr.info('请先登录再转存书签！', "提示");
        } else {
            var b = $.extend(true, {}, bookmark); // 利用jQuery执行深度拷贝
            b.tags = [{
                name: b.created_by
            }]
            pubSubService.publish('TagCtr.storeBookmark', b);
        }
    }

    $scope.copy = function(url) {
        clipboard.copy(url).then(
            function() {
                toastr.success(url + '<br/>已复制到您的剪切板', "提示");
            },
            function(err) {
                toastr.error(url + '<br/>复制失败', "提示");
            }
        );
    }

    $scope.detailBookmark = function(b) {
        var bookmark = $.extend(true, {}, b); // 利用jQuery执行深度拷贝
        bookmark.own = false;
        bookmark.tags = [{
            id: -1,
            name: '热门收藏'
        }];
        console.log(JSON.stringify(bookmark));
        pubSubService.publish('TagCtr.showBookmarkInfo', bookmark);
    }

    $scope.loadHotBookmarks = function() {
        if (!$scope.loadBusy && !$scope.random) {
            console.log('begin loadHotBookmarks.........')
            var menusScope = $('div[ng-controller="menuCtr"]').scope();
            var login = (menusScope && menusScope.login) || false;
            if (login) {
                getHotBookmarks();
            } else {
                toastr.remove();
                $scope.toastrId = toastr.info('想要查看更多热门标签，请先登录！', "提示");
            }
        }
    }

    // 快捷键r随机推荐
    $document.bind("keydown", function(event) {
        $scope.$apply(function() {
            // console.log(event.keyCode);
            var menusScope = $('div[ng-controller="menuCtr"]').scope();
            var login = (menusScope && menusScope.login) || false;
            var blur = (menusScope && menusScope.blur) || false;
            // r按键，显示
            if (event.keyCode == 82 && login && (!blur)) {
                $scope.randomHotBookmarks();
            }
        })
    });

    $scope.randomHotBookmarks = function() {
        var menusScope = $('div[ng-controller="menuCtr"]').scope();
        var login = (menusScope && menusScope.login) || false;
        if (login) {
            $scope.random = true;
            var beginDay = new Date(2016, 7, 15); // 注意日期是从0 ~ 11
            var now = new Date();
            var dayGap = parseInt(Math.abs(now - beginDay) / (1000 * 60 * 60 * 24)) + 1;
            $scope.curDay = -(parseInt(Math.random() * 1000000) % dayGap);
            $scope.bookmarks = [];
            getHotBookmarks();
        } else {
            $scope.toastrId = toastr.info('您只有先登录，才能使用查看随机热门标签', "提示");
        }
    }

    $scope.setHoverBookmark = function(bookmark) {
        $scope.hoverBookmark = bookmark;
    }

    // 在输入文字的时候也会触发，所以不要用Ctrl,Shift之类的按键
    $document.bind("keydown", function(event) {
        $scope.$apply(function() {
            var key = event.key.toUpperCase();
            if ($scope.hoverBookmark && dataService.keyShortcuts()) {
                if (key == 'I') {
                    $scope.detailBookmark($scope.hoverBookmark)
                } else if (key == 'C') {
                    $scope.copy($scope.hoverBookmark.url)
                }
            }
        })
    });

    function getHotBookmarks() {
        getHotBookmarksbyAPI(); // 先实时获取，实时获取失败再从缓存中获取

        var menusScope = $('div[ng-controller="menuCtr"]').scope();
        var login = (menusScope && menusScope.login) || false;
        var index = login ? dataService.LoginIndexHot : dataService.NotLoginIndexHot;
        pubSubService.publish('Common.menuActive', {
            login: login,
            index: index
        });
    }

    function getHotBookmarksbyAPI() {
        $scope.loadBusy = true;
        var requireData = {
            userId: null,
            lastupdataTime: new Date().getTime(),
            pageNo: 1,
            pageSize: 1000,
            sort: 'desc',
            renderType: 0,
            date: curentDate($scope.curDay, "yyyy年M月d日"),
            idfa: "d4995f8a0c9b2ad9182369016e376278",
            os: "ios",
            osv: "9.3.5"
        }
        var api = "https://api.shouqu.me/api_service/api/v1/daily/dailyMark";
        $.ajax({
            url: api,
            type: 'post',
            data: requireData,
            success: function(json) {
                // console.log('success............', json, JSON.stringify(json.data.list[0]) );
                $scope.loadBusy = false;
                var alterRex = "/mmbiz.qpic.cn|images.jianshu.io|zhimg.com/g";
                var defaultSnap = "./images/snap/default.png"
                var defaultFavicon = "./images/favicon/default.ico"
                $timeout(function() {
                    if (json.code == 200) {
                        var bookmarkList = json.data.list;
                        bookmarkList.forEach((bookmark) => {
                            var b = {};
                            b.title = bookmark.title;
                            b.url = bookmark.url;
                            b.favicon_url = bookmark.sourceLogo || defaultFavicon;
                            b.created_by = bookmark.sourceName;
                            b.snap_url = defaultSnap;
                            if (bookmark.imageList.length >= 1) {
                                if (bookmark.imageList[0].url) {
                                    b.snap_url = (json.data.pageNo == 1 ? (bookmark.imageList[0].url.match(alterRex) != null ? defaultSnap : bookmark.imageList[0].url) : defaultSnap);
                                } else {
                                    for (var i = 0; i < bookmark.images.length; i++) {
                                        if (bookmark.images[i]) {
                                            b.snap_url = bookmark.images[i];
                                            break;
                                        }
                                    }
                                }
                            }
                            b.fav_count = bookmark.favCount;
                            b.created_at = $filter('date')(new Date(bookmark.createtime < bookmark.updatetime ? bookmark.createtime : bookmark.updatetime), "yyyy-MM-dd HH:mm:ss");
                            b.last_click = $filter('date')(new Date(bookmark.createtime > bookmark.updatetime ? bookmark.createtime : bookmark.updatetime), "yyyy-MM-dd HH:mm:ss");
                            b.id = bookmark.articleId;

                            b.edit = false;
                            $scope.bookmarks.push(b);
                        })
                        $scope.curDay--;
                        updateEditPos();
                    } else {
                        toastr.error('获取热门书签失败！失败原因：' + json.message + "。将尝试从缓存中获取！", "提示");
                        getHotBookmarksbyCache();
                    }
                }, 100);
            },
            error: function(json) {
                $scope.loadBusy = false;
                toastr.error('获取热门书签失败！失败原因：' + json.message + "。将尝试从缓存中获取！", "提示");
                getHotBookmarksbyCache();
            }
        });
    }

    function getHotBookmarksbyCache() {
        $scope.loadBusy = true;
        var date = curentDate($scope.curDay, "yyyyMMdd");
        if (date < "20160715") {
            toastr.info('您已将将所有的热门标签都加载完了！', "提示");
            $scope.loadBusy = false;
            return; // 这是最早的了。
        }
        var params = {
            date: date,
        }
        bookmarkService.getHotBookmarks(params)
            .then((data) => {
                data.forEach((bookmark) => {
                    bookmark.created_at = $filter('date')(new Date(bookmark.updatetime), "yyyy-MM-dd HH:mm:ss");
                    bookmark.last_click = $filter('date')(new Date(bookmark.createtime), "yyyy-MM-dd HH:mm:ss");
                    bookmark.edit = false;
                    $scope.bookmarks.push(bookmark);
                })
                $scope.curDay--;
                $scope.loadBusy = false;
                if (data && data.length == 0) {
                    getHotBookmarksbyCache(); // 没有继续请求
                }
                updateEditPos();
            })
            .catch((err) => {
                toastr.error("getHotBookmarksbyCache: " + JSON.stringify(err), "提示");
                $scope.curDay--;
                $scope.loadBusy = false;
                getHotBookmarksbyCache(); // 没有继续请求
                updateEditPos();
            });
    }

    // TODO: 我要将编辑按钮固定在容器的右上角
    $(window).resize(updateEditPos);
    updateEditPos();

    function curentDate(i, format) {
        if (i == undefined) {
            i = 0;
        }
        if (format == undefined) {
            format = 'yyyyMMddhhmmss'
        }
        var now = new Date();
        now.setTime(now.getTime() + i * 24 * 60 * 60 * 1000);
        clock = $filter('date')(now, format);
        return clock;
    }

    function updateEditPos() {
        for (var i = 1; i <= 100; i += 10) {
            setTimeout(function() {
                var offset = $('.js-hot-card').offset();
                if (offset) {
                    var t = offset.top;
                    var l = offset.left;
                    var w = $('.js-hot-card').width();
                    $('.js-hot-random').offset({
                        top: t + 10,
                        left: l + w - 10,
                    })
                }
            }, 100 * i)
        }
    }

}]);
