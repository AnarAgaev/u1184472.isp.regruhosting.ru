/**
 * Калькулятор расчёта стоимости продукции
 * и добавления расчиитаного продукта в корзину
 */
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById('productCalcForm');

    if (form) {
        const btnValuePlus = form.querySelector('.value-checker__btn_plus');
        const btnValueMinus = form.querySelector('.value-checker__btn_minus');
        const value = form.querySelector('.value');
        const address = form.querySelector('.address');
        const productPricesJson = document.getElementById('productPrices');
        const productPrices = JSON.parse(productPricesJson.dataset.productPrices);
        const deliveryPricesJson = document.getElementById('deliveryPrices');
        const factories = JSON.parse(deliveryPricesJson.dataset.deliveryPrices);
        const resContainer = document.getElementById('calcResultContainerModal');
        const errCoordsContainer = document.getElementById('calcErrorCoordsContainer');
        const errRouteContainer = document.getElementById('calcErrorRouteContainer');
        const optimalFactory = document.getElementById('optimalFactory');
        const valueInput = document.getElementById('valueInput');
        const addressInput = document.getElementById('addressInput');

        let builtRout;
        let coordsFromMap;

        btnValuePlus.addEventListener('click', function () {
            value.value = editValue(
                true,
                value.value);
        });

        btnValueMinus.addEventListener('click', function () {
            value.value = editValue(
                false,
                value.value);
        });

        // Инициализируем Яндкс карту
        ymaps.ready(productCalcMapInit);

        function productCalcMapInit() {
            let productCalcMap = new ymaps.Map("productCalcMap",
                {
                    center: [55.907807031377885,37.54312876660157],
                    zoom: 10,
                    controls: [],
                },
                {
                    balloonMaxWidth: 250,
                }
            );

            productCalcMap.controls.add('zoomControl');
            productCalcMap.behaviors.disable('scrollZoom');

            // Чистим карту
            function cleanMap() {
                productCalcMap.balloon.close();
                productCalcMap.geoObjects.remove(builtRout);
                productCalcMap.setCenter([55.907807031377885,37.54312876660157], 10);
            }

            // Обрабатываем открытие и закрытие модальной формы и очистку всех данных
            function modalCalcClose() {
                document.body.classList.remove("modal-open");
                modalProductCalc.classList.remove("show");
                valueInput.value = 0;
                valueInput.parentElement.parentElement.classList.remove('has__error');
                addressInput.value = '';
                addressInput.parentElement.classList.remove('has__error');
                calcResultContainerModal.classList.remove('visible');
                calcErrorCoordsContainer.classList.remove('visible');
                calcErrorRouteContainer.classList.remove('visible');

                cleanMap();
            }

            showModalProductCalc.addEventListener('click', function () {
                document.body.classList.add("modal-open");
                modalProductCalc.classList.add("show");
            });

            btnModalCalcClose.addEventListener('click', modalCalcClose);

            modalProductCalc.addEventListener("click", function (evt) {
                evt.target.id === 'modalProductCalc'
                    ? modalCalcClose()
                    : false;
            });

            // В цикле добавляем метки на карту
            for(let i in factories) {
                productCalcMap.geoObjects.add(new ymaps.Placemark(
                    JSON.parse(factories[i].coordinates),
                    {
                        balloonContentHeader: factories[i].name,
                        balloonContentBody: factories[i].address
                    },
                    {
                        iconLayout: 'default#image',
                        iconImageHref: '/local/templates/.default/img/mark.png',
                        iconImageSize: [36, 43],
                        iconImageOffset: [-15, -35]
                    })
                )
            }

            // Обработка события, возникающего при клике
            // левой кнопкой мыши в любой точке карты.
            // При возникновении такого события откроем балун.
            productCalcMap.events.add('click', function (evt) {
                productCalcMap.balloon.close(); // закрываем открытый балун

                const receivedCoords = evt.get('coords');

                // Показываем новый балун
                productCalcMap.balloon.open(receivedCoords, {
                    contentHeader:'Координаты места<br>доставки:',
                    contentBody:'<span>[' + [
                        receivedCoords[0].toPrecision(10),
                        receivedCoords[1].toPrecision(10)
                    ].join(', ') + ']</span>',
                    contentFooter:'<i>Координаты скопированы в поле<br>адрес доставки.</i>'
                });

                // Пушим координаты в поле Адрес доставки
                address.value = '[' + [
                    receivedCoords[0],
                    receivedCoords[1]
                ].join(',') + ']';

                // Сохраняем координаты в переменную
                // для декодирования и расчёта
                // стоимости доставки
                coordsFromMap = []; // облуляем масси при каждом клике по карте
                coordsFromMap.push(receivedCoords[0]);
                coordsFromMap.push(receivedCoords[1]);
            });

            // Скрываем хинт при открытии балуна.
            productCalcMap.events.add('balloonopen', function () {
                productCalcMap.hint.close();
            });

            // Обработчик отправки формы
            form.addEventListener('submit', function(evt) {
                evt.preventDefault();

                productCalcMap.balloon.close();
                productCalcMap.geoObjects.remove(builtRout);
                resContainer.classList.remove('visible');
                errCoordsContainer.classList.remove('visible');
                errRouteContainer.classList.remove('visible');

                // Сбрасываем ошибки на полях формы
                value.parentElement.parentElement
                    .classList
                    .remove('has__error');
                address.parentElement
                    .classList
                    .remove('has__error');

                let formValid = true;

                if (address.value === '') {
                    address.parentElement
                        .classList
                        .add('has__error');
                    address.focus();
                    formValid = false;
                }

                if (value.value === '' || value.value === '0') {
                    value.parentElement.parentElement
                        .classList
                        .add('has__error');
                    formValid = false;
                }

                if (formValid) {
                    spinner.classList.add('visible');

                    let errCounter = 0;

                    /**
                     * Для того чтобы на ошибке вновь заново запускать запрос данных
                     * от сервиса Яндекс карт, обернули код в функцию и в случае ошибки
                     * вызываем её рекурсивно
                     * Считаем ошибки в переменной errCounter.
                     * Если ошибок более десяти выводим сообщение об ошибке
                     */
                    function calculate() {
                        let addressValue = validCoords(address.value)
                            ? coordsFromMap
                            : address.value;

                        const myGeocoder = ymaps.geocode(addressValue);

                        myGeocoder.then(getRouteDone,getRouteFail);
                    }

                    function getRouteDone(response) {
                        if (!response.geoObjects.get(0)) {
                            spinner.classList.remove('visible');
                            errCoordsContainer.classList.add('visible');
                            addressInput.parentElement.classList.add('has__error');
                        }
                        else {
                            // Сбрасываем расстояния, роуты, цену доставки, цену продукта
                            // и итоговую цену у заводов для корректного пересчёта расстояний
                            for (let i in factories) {
                                delete factories[i]['distance'];
                                delete factories[i]['route'];
                                delete factories[i]['deliveryPrice'];
                                delete factories[i]['productPrice'];
                                delete factories[i]['finalPrice'];
                            }

                            /* В цикле проходим по всем заводам и расчитываем расстояние
                             * от каждого завода до точки поставки продукции.
                             *
                             * Полученный результат сохраняем в массиве завода.
                             *
                             * Так же в массив завода сохраняем полученный путь,
                             * чтобы потом пушить его в карту
                             */
                            for(let i in factories) {
                                ymaps.route([
                                    JSON.parse(factories[i].coordinates),
                                    response.geoObjects.get(0).geometry.getCoordinates()
                                ], {
                                    mapStateAutoApply: true,
                                }).then(function (route) {
                                    // Ловим завод по которому рассчитывали маршрут
                                    const factoryID = catchFactory(route["requestPoints"][0], factories);

                                    // Сохраняем длинну маршрута в массив с данными заводов
                                    factories[factoryID]['distance'] = Math.ceil(route.getLength()/1000);

                                    // Сохраняем полученный объект ROUTE чтобы потом пушить его в карту
                                    factories[factoryID]['route'] = route;

                                    // Считаем стомиость доставки и сохраняем в переменную deliveryPrice в объект завода
                                    factories[factoryID]['deliveryPrice'] = null;

                                    for (let key in factories[factoryID]['prices']) {
                                        if (factories[factoryID]['distance'] <= Number(key)) {
                                            // Рссчитываем стоимость доставки как:
                                            // цена за транспортировку куба * количество кубов
                                            // !!! Без учёта расстояния
                                            factories[factoryID]['deliveryPrice'] = parseFloat(factories[factoryID]['prices'][key].replace(/,/, '.')) * value.value;
                                            break;
                                        }
                                    }

                                    // Считаем стомость товара на каждом заводе и итоговую стоимость
                                    // Сохраняме полученные данные в объект завода в переменные
                                    // productPrice и finalPrice соответственно
                                    if (productPrices[factoryID] !== '' && factories[factoryID]['deliveryPrice'] !== null) {
                                        factories[factoryID]['productPrice'] = parseFloat(productPrices[factoryID].replace(/,/, '.')) * value.value;
                                        factories[factoryID]['finalPrice'] = (factories[factoryID]['productPrice'] + factories[factoryID]['deliveryPrice']).toFixed(2);
                                    } else {
                                        factories[factoryID]['productPrice'] = null;
                                        factories[factoryID]['finalPrice'] = null;
                                    }

                                    /* Для того чтобы гарантировать что все асинхронные запрсы выполенены
                                     * и все координаты получены на каждой итерации цикла, проверяем
                                     * все заводы на наличие у них дистанции до выбранного места доставки
                                     * и если дистанция есть у всех, а токое возомжно только после того
                                     * как последний асинхронный запрос вернёт данные, определяем кротчайший
                                     * маршрут до завода и пушим его в карту
                                    */
                                    let isRequestsFinish = true;
                                    for (let i in factories) {
                                        if (!factories[i]['distance']) {
                                            isRequestsFinish = false;
                                            break;
                                        }
                                    }

                                    // Если у всех заводов посчитана дистанция
                                    // ищем на каком заводе минимальная итоговая цен
                                    // и пушум завод в карту
                                    if(isRequestsFinish) {
                                        let factoryId = null;

                                        // Определяем завод с самой низкой итогвой ценой товара
                                        // Итоговая цена = цена доставки + цена товара
                                        for (let id in factories) {
                                            if (factories[id]['distance'] && factories[id]['finalPrice']) {
                                                factoryId = !factoryId
                                                    ? id
                                                    : factories[id]['finalPrice'] < factories[factoryId]['finalPrice']
                                                        ? id
                                                        : factoryId;
                                            }
                                        }

                                        // Показываем пользователю минмальную цену товара с учётом доставки
                                        // или выводим сообщение что не можем доставить (слишком далеко)
                                        if (factoryId) {
                                            const name = document.getElementById('calcProductNameContainer');
                                            const price = document.getElementById('calcPriceContainer');
                                            const factoryName = document.getElementById('calcFactoryContainer');
                                            const distance = document.getElementById('calcRoutContainer');
                                            const valueProd = document.getElementById('calcValueContainer');
                                            const coords = document.getElementById('calcCoordsContainer');
                                            const deliveryPrice = document.getElementById('calcProdDeliveryPriceContainer');
                                            const productPrice = document.getElementById('calcProductPriceContainer');

                                            name.innerText = $('#productNameController').val();
                                            price.innerText = factories[factoryId]['finalPrice'];
                                            factoryName.innerText = factories[factoryId]['name'];
                                            distance.innerText = factories[factoryId]['distance'] + ' км.';
                                            valueProd.innerHTML = value.value + ' м<sup>3</sup>';
                                            coords.innerText = address.value;
                                            deliveryPrice.innerText = (factories[factoryId]['deliveryPrice']).toFixed(2) + ' руб.';
                                            productPrice.innerText = (factories[factoryId]['productPrice']).toFixed(2) + ' руб.';

                                            // Сохраняем полученные данные в скрытые поля формы
                                            // для отправки на сервер и добавления их в переменную сессии
                                            // с данными корзины
                                            $('#routeLength').val(factories[factoryId]['distance']);
                                            $('#deliveryPriceController').val((factories[factoryId]['deliveryPrice']).toFixed(2));
                                            $('#productPriceController').val((factories[factoryId]['productPrice']).toFixed(2));
                                            $('#finalPrice').val(factories[factoryId]['finalPrice']);

                                            // Показываем сообщение с расчётными данными продукта
                                            resContainer.classList.add('visible');
                                        } else {
                                            // Если выбранной продукции нет ни на одном заводе
                                            // опеделяем ближайший завод к месту поставки
                                            // на котором есть данный вид продукции
                                            for(let id in factories) {
                                                if (factories[id]['distance'] && productPrices[id] !== '') {
                                                    factoryId = !factoryId
                                                        ? id
                                                        : factories[id]['distance'] < factories[factoryId]['distance']
                                                            ? id
                                                            : factoryId;
                                                }
                                            }

                                            // Показываем сообщение Слишком длинная доставка
                                            errRouteContainer.classList.add('visible');
                                        }

                                        spinner.classList.remove('visible');

                                        // Удаляем предыдущий маршрут с карты для
                                        // случаев пересчёта маршрута
                                        productCalcMap.geoObjects.remove(builtRout);

                                        // Сохраняем полученный маршрут в переменную,
                                        // чтобы потом была возможность удалить его с карты
                                        // Предыдущая строка кода: deliveryMap.geoObjects.remove(builtRout);
                                        builtRout = factories[factoryId].route;

                                        // Кастомизируем метку на карте
                                        const points = factories[factoryId].route.getWayPoints();
                                        points.options.set('preset', 'islands#orangeCircleDotIcon');
                                        points.get(0).options.set('visible', false);
                                        //points.get(points.getLength() - 1).options.set('hasBalloon', false);
                                        points.get(points.getLength() - 1).options.set('iconLayout', 'default#image');
                                        points.get(points.getLength() - 1).options.set('iconImageHref', '/local/templates/.default/img/mark.png');
                                        points.get(points.getLength() - 1).options.set('iconImageSize', [36, 43]);
                                        points.get(points.getLength() - 1).options.set('iconImageOffset', [-15, -35]);

                                        // Кастомизурем проложенный маршрут (цвет линии и прозрачность)
                                        factories[factoryId].route.getPaths().options.set({
                                            strokeColor: 'f1852c',
                                            opacity: 0.9,
                                        });

                                        // Добавляем маршрут на карту
                                        productCalcMap.geoObjects.add(factories[factoryId].route);

                                        // Сохраняем ID оптимального завода в скрытое поле формы
                                        optimalFactory.dataset.optimalFactoryId = JSON.stringify(factoryId);
                                        optimalFactory.value = factoryId;

                                        // console.log('productPrices:', productPrices);
                                        // console.log('factories:', factories);
                                        // console.log('factoryId:', factoryId);
                                        // console.log('optimalFactory:', factories[factoryId]);
                                        // console.log('name:', factories[factoryId]['name']);
                                        // console.log('address:', factories[factoryId]['address']);
                                        // console.log('distance:', factories[factoryId]['distance'], 'км.');
                                        // console.log('productPrices:', factories[factoryId]['productPrice'], 'руб.');
                                        // console.log('deliveryPrice:', factories[factoryId]['deliveryPrice'], 'руб.');
                                        // console.log('finalPrice:', factories[factoryId]['finalPrice'], 'руб.');
                                        // console.log('*********************************')
                                    }
                                });
                            }
                        }
                    }

                    function getRouteFail(err) {
                        // В случае ошибочного ответа от АПИ Яндекс карти пробуем снова до 10 раз
                        if (errCounter <= 10) {
                            calculate();
                        } else {
                            spinner.classList.remove('visible');
                            console.log(err);
                            alert("Во время работы калькулятора произошла ошибка. Попробуйте перезагрузить страницу или повторить попытку позже.");
                        }
                    }

                    // Первый запуск фунции получения данных с Яндекс карт.
                    calculate();
                }

                return false;
            });

            /**
             * 1. Добавляем товар в Сессиию.
             * 2. Меняем счётчик товаров в корзине в шапке сайта.
             * 3. Актуализируем модальное окно с Корзиной.
             */

            addProductToCart.addEventListener('click', function(evt) {
                spinner.classList.add('visible');

                $.ajax({
                    url: form.action,
                    type: "POST",
                    dataType: "JSON",
                    data: new FormData(form),
                    processData: false,
                    contentType: false,
                    success: function (response) {
                        console.log(response)

                        if (response['IS_ERRORS']) {
                            alert('Товар не добавле в Корзину. Перезагрузите страницу и попробуйте снова.')
                        } else {
                            modalCalcClose();
                            cartItemsCounter.innerText = response['CART_ITEM_COUNT'];
                            cartItemsCounter.classList.add('items-added');

                            setTimeout(function () {
                                cartItemsCounter.classList.remove('items-added');
                            }, 4500);

                            // ДОБАВЛЯЕМ ТОВАР В модальное окно Корзины
                            const product = response['GETTING_POST'];

                            // Получаем предприятие отгрузки продукции
                            const fromFactoryId = product['optimal-factory-id'];
                            const fromFactoryName = JSON.parse(product['factories'])[fromFactoryId]['name'];

                            // Получаем характеристики товара
                            let description = '';
                            if (product['product-type'] === 'concrete'
                                || product['product-type'] === 'crushedStone') {
                                description = '<b>Характеристики:</b> ' + product['product-description'] + '<br>';
                            }

                            const insertItemHtmlContent = '' +
                                '<li class="cart-modal__item" data-product-type="'+product['product-type']+'" data-pruduct-id="'+response['ADDED_ITEM_ID']+'">' +
                                '<span class="cart-modal__item__delete" title="Удалить товар из корзины"></span>' +
                                '<div class="cart-modal__item__title">'+product['product-name']+'</div>' +
                                '<div class="cart-modal__item__content d-flex flex-column align-items-start flex-sm-row align-items-sm-center">' +
                                '<span class="cart-modal__item__pic mb-3 mb-sm-0" style="background-image: url('+product['product-pic-src']+')"></span>' +
                                '<ul class="cart-modal__item__props mb-1 mb-sm-0">' +
                                '<li class="cart-modal__item__value">Количество: '+product['product-value']+' куб.м.</li>' +
                                '<li class="cart-modal__item__product-price">Цена товара: '+product['product-price']+' руб.</li>' +
                                '<li class="cart-modal__item__delivery-price">Стоимость доставки: '+product['delivery-price']+' руб.</li>' +
                                '</ul>' +
                                '<div class="cart-modal__item__result-price d-flex flex-row align-items-baseline flex-sm-column">' +
                                '<span class="pr-1 pr-sm-0">Итоговая цена:</span>' +
                                '<span class="num">'+product['final-price']+' руб.</span>' +
                                '</div>' +
                                '</div>' +
                                '<div class="cart-modal__item__inform d-flex flex-column">' +
                                '<div class="cart-modal__item__inform-title">' +
                                '<span class="controller"></span>Дополнительная информация' +
                                '</div>' +
                                '<div class="cart-modal__item__inform-body">' +
                                '<p class="mb-0">' +
                                description +
                                '<b>Место отгрузки: </b> '+fromFactoryName+'<br>' +
                                '<b>Место поставки:</b> '+product['delivery-address']+'<br>' +
                                '<b>Расстояние доставки:</b> '+product['route-length']+' км.' +
                                '</p>' +
                                '</div>' +
                                '</div>' +
                                '</li>';

                            function fnPushItemToCart(itemType) {
                                switch(itemType) {
                                    case 'concrete':
                                        return document
                                            .getElementById('cartItemsConcrete');
                                    case 'crushedStone':
                                        return document
                                            .getElementById('cartItemsCrushedStone');
                                    case 'limestoneFlour':
                                        return document
                                            .getElementById('cartItemsLimestoneFlour');
                                    case 'mineralPowder':
                                        return document
                                            .getElementById('cartItemsMineralPowder');
                                }
                            }

                            fnPushItemToCart(product['product-type'])
                                .insertAdjacentHTML('beforeend', insertItemHtmlContent);

                            // Показываем блоки с товарами и скрываем заглушку для пустой корзины
                            noProductsMsg.classList.add('hidden');
                            cartModalBody.classList.remove('hidden');
                            cartModalFooter.classList.remove('hidden');

                            // Увиличиваем итоговую стоимость всех товаров в корзине на ссумму добавленного товара
                            const newFinalCartPrice =
                                parseFloat(finalCartPriceContainer.innerText) +
                                parseFloat(product['final-price']);

                            finalCartPriceContainer.innerText =
                                (Math.round(parseFloat(newFinalCartPrice) * 100) / 100).toFixed(2);
                        }
                    },
                    error: function (xhr, desc, err) {
                        console.log('Товар не добавле в Корзину. Перезагрузите страницу и попробуйте снова.');
                        console.log(desc, err);
                    },
                    complete: function () {
                        spinner.classList.remove('visible');
                    }
                });
            });
        }
    }
});