app.controller('menuCtr', ['$scope', '$stateParams', '$state', '$window', '$timeout', '$document', 'pubSubService', 'bookmarkService', 'dataService', function($scope, $stateParams, $state, $window, $timeout, $document, pubSubService, bookmarkService, dataService) {
    console.log("Hello menuCtr")
    $scope.login = false; /**< 是否登陆 */
    $scope.selectLoginIndex = 0; /**< 默认登陆之后的选择的菜单索引，下表从 0 开始 */
    $scope.selectNotLoginIndex = 0; /**< 默认未登陆之后的选择的菜单索引，下表从 0 开始 */
    $scope.searchWord = ''; /**< 搜索关键字 */
    $scope.showStyle = null;
    $scope.searchHistory = [];
    $scope.historyTypes = dataService.historyTypes;
    $scope.quickUrl = {};
    $scope.longPress = false;

    // 防止在登陆的情况下，在浏览器里面直接输入url，这时候要更新菜单选项
    pubSubService.subscribe('Common.menuActive', $scope, function(event, params) {
        console.log("subscribe Common.menuActive, login = " + params.login + ", index = " + params.index);
        $scope.login = (params && params.login) || false;
        var index = $scope.login ? ($scope.selectLoginIndex = (params && params.index) || 0) : ($scope.selectNotLoginIndex = (params && params.index) || 0);
        updateMenuActive(index);
    });

    pubSubService.subscribe('Settings.quickUrl', $scope, function(event, params) {
        $scope.quickUrl = params.quickUrl;
    });

    $scope.loginMenus = dataService.loginMenus; // 登陆之后显示的菜单数据。uiSerf：内部跳转链接。
    $scope.notLoginMenus = dataService.notLoginMenus; // 未登陆显示的菜单数据

    /**
     * @func
     * @desc 点击搜索按钮搜索书签
     */
    $scope.search = function(searchWord) {
        console.log('search......', searchWord);

        $scope.login = true;
        var searchOption = $('.js-search-option').dropdown('get value') || 0;
        if (searchOption == 0) {
            $state.go('search', {
                searchWord: searchWord,
            }, {
                reload: true,
            })
            updateMenuActive($scope.selectLoginIndex = 0);
        } else if (searchOption == 1) {
            $window.open('https://www.google.com.hk/#newwindow=1&safe=strict&q=' + encodeURIComponent(searchWord), '_blank');
        } else if (searchOption == 2) {
            $window.open('https://github.com/search?utf8=%E2%9C%93&q=' + encodeURIComponent(searchWord) + '&type=', '_blank');
        } else if (searchOption == 3) {
            $window.open('https://stackoverflow.com/search?q=' + encodeURIComponent(searchWord), '_blank');
        } else if (searchOption == 4) {
            $window.open('http://www.baidu.com/s?tn=mybookmark.cn&ch=3&ie=utf-8&wd=' + encodeURIComponent(searchWord), '_blank');
        } else if (searchOption == 5) {
            console.log('search note, word = ', searchWord);
            $state.go('note', {
                searchWord: searchWord,
            }, {
                reload: true,
            })
            updateMenuActive($scope.selectLoginIndex = dataService.LoginIndexNote);
        }

        if (!searchWord) {
            return;
        }

        var newItem = {
            t: searchOption,
            d: searchWord,
        }
        var delIndex = -1;
        $scope.searchHistory.unshift(newItem);
        $scope.searchHistory.forEach((item, index) => {
            if (index >= 1 && item.t == searchOption && item.d == searchWord) {
                delIndex = index;
            }
        })
        if (delIndex >= 0) {
            $scope.searchHistory.splice(delIndex, 1);
        }

        // 大于30的不保存到数据库
        if (searchWord.length <= 30) {
            saveHistory();
        }
    }

    $scope.searchByHistory = function(type, data) {
        $scope.searchWord = data;
        $('.search-item').val($scope.searchWord);

        $('.js-search-option').dropdown('set value', type);
        var types = $scope.historyTypes;
        $('.js-search-option').dropdown('set text', types[type]);
        $('.js-search-option').dropdown('save defaults', types[type]);
        $('.js-search-option .menu .item').removeClass('active');
        $('.js-search-option .menu .item:eq(' + type + ')').addClass('active');
        $('.js-history-popup').removeClass('visible').addClass('hidden');
        $scope.search(data);
    }

    $scope.delHistory = function(type, data) {
        var delIndex = -1;
        $scope.searchHistory.forEach((item, index) => {
            if (index >= 1 && item.t == type && item.d == data) {
                delIndex = index;
            }
        })
        if (delIndex >= 0) {
            $scope.searchHistory.splice(delIndex, 1);
        }
        saveHistory();
        $timeout(function() {
            $('.js-history-popup').removeClass('hidden').addClass('visible');
        }, 500)
    }

    $scope.updateShowStyle = function(showStyle) {
        console.log('updateShowStyle', showStyle);
        $scope.showStyle = showStyle;
        $('.js-radio-' + showStyle).checkbox('set checked');
        $state.go('bookmarks', {
            showStyle: showStyle,
        }, {
            reload: true,
        })
    }

    $scope.showAddBookmarkMoadl = function() {
        pubSubService.publish('MenuCtr.showAddBookmarkMoadl', {
            'action': 'add'
        });
    }
    $scope.logout = function() {
        bookmarkService.logout({})
            .then((data) => {
                console.log('logout..........', data)
                $scope.login = false;
                $state.go('login', {})
            })
            .catch((err) => console.log('logout err', err));
    }

    $scope.showUpdate = function () {
        $state.go('settings', {
            formIndex: 5,
        });
        pubSubService.publish('Common.menuActive', {
            login: true,
            index: dataService.LoginIndexSettings
        });
    }

    function updateMenuActive(index) {
        $('.ui.menu a.item').removeClass('selected');
        $('.ui.menu a.item:eq(' + index + ')').addClass('selected');
    }

    function saveHistory() {
        var datas = [];
        $scope.searchHistory = $scope.searchHistory.slice(0, 15); // 最多保留15个历史记录
        $scope.searchHistory.forEach((item, index) => {
            datas.push({
                t: item.t,
                d: item.d,
            })
        })

        var parmes = {
            searchHistory: JSON.stringify(datas),
        };
        bookmarkService.updateSearchHistory(parmes)
            .then((data) => {
                if (data.retCode == 0) {
                    // toastr.success('历史搜索更新成功', "提示");
                } else {
                    toastr.error('历史搜索更新失败。错误信息：' + data.msg, "错误");
                }
            })
            .catch((err) => {
                toastr.error('历史搜索更新失败。错误信息：' + JSON.stringify(err), "错误");
            });
    }

    bookmarkService.userInfo({})
        .then((user) => {
            $scope.searchHistory = JSON.parse(user.search_history || '[]');
            $scope.quickUrl = JSON.parse(user.quick_url || '{}');

            $timeout(function() {
                var showStyle = (user && user.show_style) || 'navigate';
                if (showStyle) {
                    $('.js-bookmark-dropdown' + ' .radio.checkbox').checkbox('set unchecked');
                    $('.js-radio-' + showStyle).checkbox('set checked');
                    $('.js-bookmark-dropdown' + ' .field.item').removeClass('active selected');
                    $('.js-field-' + showStyle).addClass('active selected');
                }
            }, 1000)
        })
        .catch((err) => {
            console.log(err);
            // toastr.error('获取信息失败。错误信息：' + JSON.stringify(err), "错误");
        });

    $timeout(function() {
        $('.suggest')
            .popup({
                title: '操作提示',
                position: 'bottom center',
                variation: "very wide",
                html: "<span><span class='fontred'>特别提示：对照更新日志，如果功能不正常，请先尝试清除浏览器缓存！<br/>点击该按钮即可查看更新日志！</span><br/>1、在任意页面，按A键添加备忘录。<br/>2、在热门收藏页面，按R键随机查看热门收藏。<br/>3、在任意页面，按数字键切换菜单栏。<br/>4、在书签页面鼠标放在书签上，按C复制书签链接<br/>5、在书签页面鼠标放在书签上，按E编辑书签<br/>6、在书签页面鼠标放在书签上，按D删除书签<br/>7、在书签页面鼠标放在书签上，按I查看书签详情<br/>8、在任意页面，按INSERT做添加书签<br/>9、在任意页面，按ESC退出弹窗<br/></span>"
            });
    }, 1000)

    // 在输入文字的时候也会触发，所以不要用Ctrl,Shift之类的按键
    $document.bind("keydown", function(event) {
        $scope.$apply(function() {
            var key = event.key.toUpperCase();
            if (key == 'CONTROL' || key == 'SHIFT' || key == 'ALT') {
                $scope.longPress = true;
            }

            if (dataService.keyShortcuts()) {
                // 全局处理添加备忘录
                // console.log('keydown key = ', key);
                if (key == 'A') {
                    if ($scope.selectLoginIndex !== dataService.LoginIndexNote) {
                        updateMenuActive($scope.selectLoginIndex = dataService.LoginIndexNote);
                        $state.go('note', {
                            key: key,
                        }, {
                            reload: true,
                        })
                    }
                }

                // 数字键用来切换菜单
                if (!isNaN(key)) {
                    var num = parseInt(key);
                    pubSubService.publish('Common.menuActive', {
                        login: $scope.login,
                        index: num - 1
                    });
                    $state.go(dataService.loginMenus[num - 1].uiSref, {}, {
                        reload: true,
                    })
                } else {
                    var url = $scope.quickUrl[key];
                    if (url) {
                        $window.open(url, '_blank');
                    }
                }
            }
        })
    });

    // 在输入文字的时候也会触发，所以不要用Ctrl,Shift之类的按键
    $document.bind("keyup", function(event) {
        $scope.$apply(function() {
            var key = event.key.toUpperCase();
            // console.log('keyup key = ', key);
            if (key == 'CONTROL' || key == 'SHIFT' || key == 'ALT') {
                $scope.longPress = false;
            }
        })
    });

}]);
