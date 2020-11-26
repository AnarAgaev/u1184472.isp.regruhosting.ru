/* Калькулятор расчёта стоимости доставки */
document.addEventListener("DOMContentLoaded", () => {
    const deliveryForm = document
        .getElementById('deliveryСost');

    if (deliveryForm) {
        const body = document.body;
        const btnPlus = deliveryForm.querySelector('.value-checker__btn_plus');
        const btnMinus = deliveryForm.querySelector('.value-checker__btn_minus');
        const value = deliveryForm.querySelector('.deliveryValue');
        const address = deliveryForm.querySelector('.deliveryAddress');
        const modal = document.getElementById('modalCoordsError');
        const msg = document.getElementById('msgCoordsError');
        const btn = document.getElementById('btnCloseCoordsError');
        const modalLongRout = document.getElementById('modalToLongRoute');
        const msgLongRout = document.getElementById('msgToLongRoute');
        const btnLongRout = document.getElementById('btnToLongRoute');
        const calcResultContainer = document.getElementById('calcResultContainer');
        let builtRout;

        btn.addEventListener('click', () => {
            modal.classList.remove('show');
            msg.classList.remove('visible');
            body.classList.remove('modal-open');
        });

        btnLongRout.addEventListener('click', () => {
            modalLongRout.classList.remove('show');
            msgLongRout.classList.remove('visible');
            body.classList.remove('modal-open');
        });

        const editValue = (direction, curValue) => {
            let newValue = curValue === ""
                ? 0
                : direction
                    ? Number(curValue) + 1
                    : Number(curValue) - 1;

            return newValue < 0 ? 0 : newValue;
        };
        let coordsFromMap = [];

        btnPlus.addEventListener('click', () => {
            value.value = editValue(
                true,
                value.value);
        });

        btnMinus.addEventListener('click', () => {
            value.value = editValue(
                false,
                value.value);
        });

        // Получаем координаты предприятий с сервера и сохраняем в переменной
        let factories;
        getResource("/utils/get-price.php")
            .then(response  => {
                factories = response;

                // Инизицализируем Яндкс карту на странице Доставка
                // только полсе того как придут координаты предприятий
                ymaps.ready(deliveryMapInit);
            });

        function deliveryMapInit() {
            let deliveryMap = new ymaps.Map("deliveryMap",
                {
                    center: [55.907807031377885,37.54312876660157],
                    zoom: 10,
                    controls: [],
                },
                {
                    balloonMaxWidth: 250,
                }
            );

            deliveryMap.controls.add('zoomControl');
            deliveryMap.behaviors.disable('scrollZoom');

            // В цикле добавляем метки на карту
            for(let i = 0; i < factories.length; i++) {
                deliveryMap.geoObjects.add(new ymaps.Placemark(
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
                    }),
                );
            }

            // Обработка события, возникающего при щелчке
            // левой кнопкой мыши в любой точке карты.
            // При возникновении такого события откроем балун.
            deliveryMap.events.add('click', evt => {
                deliveryMap.balloon.close();
                const receivedCoords = evt.get('coords');

                // Показываем балун
                deliveryMap.balloon.open(receivedCoords, {
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
                // для декодирования и расчёта стоимости доставки
                coordsFromMap = [];
                coordsFromMap.push(receivedCoords[0]);
                coordsFromMap.push(receivedCoords[1]);
            });

            // Скрываем хинт при открытии балуна.
            deliveryMap.events.add('balloonopen', function (e) {
                deliveryMap.hint.close();
            });

            // Обработчик отправки формы
            deliveryForm.addEventListener('submit', evt => {
                evt.preventDefault();
                deliveryMap.balloon.close();
                calcResultContainer.classList.remove('visible');

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

                if (value.value === '' || value.value == '0') {
                    value.parentElement.parentElement
                        .classList
                        .add('has__error');
                    formValid = false;
                }

                if (formValid) {
                    spinner.classList.add('visible');

                    let addressValue = validCoords(address.value)
                        ? coordsFromMap
                        : address.value;

                    const myGeocoder = ymaps.geocode(addressValue);
                    myGeocoder.then(
                        response => {
                            if (!response.geoObjects.get(0)) {
                                spinner.classList.remove('visible');
                                modal.classList.add('show');
                                msg.classList.add('visible');
                                body.classList.add('modal-open');
                            }
                            else {
                                // Чистим расстояния и роуты у заводов для корректного пересчёта расстояний
                                for (let i = 0; i < factories.length; i++) {
                                    delete factories[i]['distance'];
                                    delete factories[i]['route'];
                                }

                                /* В цикле проходим по всем заводам и расчитываем расстояние
                                 * от каждого завода до точки поставки продукции.
                                 *
                                 * Полученный результат сохраняем в массиве завода,
                                 * чтобы потом обойти все заводы и найти наименьший путь.
                                 *
                                 * Так же в массив завода сохраняем полученный путь,
                                 * чтобы потом пушить его в карту
                                 */
                                for(let i = 0; i < factories.length; i++) {
                                    ymaps.route([
                                        JSON.parse(factories[i].coordinates),
                                        response.geoObjects.get(0).geometry.getCoordinates()
                                    ], {
                                        mapStateAutoApply: true,
                                    }).then(route => {
                                        // Сохраняем длинну маршрута в массив с данными заводов
                                        factories[i]['distance'] = Math.ceil(route.getLength()/1000);
                                        // Сохраняем полученный объект ROUTE чтобы потом пушить его в карту
                                        factories[i]['route'] = route;

                                        /* Для того чтобы гарантировать что все асинхронные запрсы выполенены
                                         * и все координаты получены на каждой итерации цикла, проверяем
                                         * все заводы на наличие у них дистанции до выбранного места доставки
                                         * и если дистанция есть у всех, а токое возомжно только после того
                                         * как последний асинхронный запрос вернёт данные, определяем кротчайший
                                         * маршрут до завода и пушим его в карту
                                        */
                                        let isRequestsFinish = true;
                                        for (let i = 0; i < factories.length; i++) {
                                            if (!factories[i]['distance']) {
                                                isRequestsFinish = false;
                                                break;
                                            }
                                        }

                                        // Если у всех заводов посчитана дистанция пушим наименьший маршрут в карту
                                        if(isRequestsFinish) {
                                            let distance = 9999999999;
                                            let factoryNum;
                                            let finalPrice = null;

                                            // Определяем самый близкий завод
                                            for (let i = 0; i < factories.length; i++) {
                                                if (factories[i]['distance'] < distance) {
                                                    factoryNum = i;
                                                    distance = factories[i]['distance'];
                                                }
                                            }

                                            spinner.classList.remove('visible');

                                            // Удаляем предыдущий маршрут с карты для
                                            // случаев пересчёта маршрута
                                            deliveryMap.geoObjects.remove(builtRout);

                                            // Сохраняем полученный маршрут в переменную,
                                            // чтобы потом была возможность удалить его с карты
                                            // Предыдущая строка кода: deliveryMap.geoObjects.remove(builtRout);
                                            builtRout = factories[factoryNum].route;

                                            // Кастомизируем метки на карте
                                            const points = factories[factoryNum].route.getWayPoints();
                                            points.options.set('preset', 'islands#orangeCircleDotIcon');
                                            points.get(0).options.set('visible', false);
                                            //points.get(points.getLength() - 1).options.set('hasBalloon', false);
                                            points.get(points.getLength() - 1).options.set('iconLayout', 'default#image');
                                            points.get(points.getLength() - 1).options.set('iconImageHref', '/local/templates/.default/img/mark.png');
                                            points.get(points.getLength() - 1).options.set('iconImageSize', [36, 43]);
                                            points.get(points.getLength() - 1).options.set('iconImageOffset', [-15, -35]);

                                            // Кастомизурем проложенный маршрут (цвет линии и прозрачность)
                                            factories[factoryNum].route.getPaths().options.set({
                                                strokeColor: 'f1852c',
                                                opacity: 0.9,
                                            });

                                            // Добавляем маршрут на карту
                                            deliveryMap.geoObjects.add(factories[factoryNum].route);

                                            // Считаем сумму доставки и выводим сообщение пользователю
                                            for (let key in factories[factoryNum]['prices']) {
                                                const price = factories[factoryNum]['prices'][key];

                                                if (distance <= Number(key) && price != '') {
                                                    // Рссчитываем стоимость доставки как:
                                                    // расстояние * цена за транспортировку куба * количество кубов
                                                    finalPrice = distance * parseFloat(price.replace(/,/, '.')) * value.value;
                                                    break;
                                                }
                                            }

                                            // Говорим пользователю ЦЕНУ или что не можем доставить (слишком далеко)
                                            if (finalPrice) {
                                                const calcPriceContainer = document.getElementById('calcPriceContainer');
                                                const calcFactoryContainer = document.getElementById('calcFactoryContainer');
                                                const calcRoutContainer = document.getElementById('calcRoutContainer');
                                                const calcCoordsContainer = document.getElementById('calcCoordsContainer');

                                                calcResultContainer.classList.add('visible');
                                                calcPriceContainer.innerText = finalPrice;
                                                calcFactoryContainer.innerText = factories[factoryNum]['name'];
                                                calcRoutContainer.innerText = distance + ' км.';
                                                calcCoordsContainer.innerText = address.value;
                                            } else {
                                                modalLongRout.classList.add('show');
                                                msgLongRout.classList.add('visible');
                                                body.classList.add('modal-open');
                                            }

                                            // console.log('factories: ',factories);
                                            // console.log('distance: ', distance);
                                            // console.log('factoryFrom: ',factories[factoryNum]);
                                            // console.log('factoryNum: ', factoryNum);
                                            // console.log('finalPrice: ',finalPrice);
                                        }
                                    });
                                }
                            }
                        },
                        err => {
                            console.log(err);
                            alert("Во время работы калькулятора произошла ошибка. Попробуйте повторить попытку позже.")
                        }
                    );

                }
            });
        }
    }
});