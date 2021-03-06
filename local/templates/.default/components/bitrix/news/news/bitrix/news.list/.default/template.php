<?if(!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true)die();
/** @var array $arParams */
/** @var array $arResult */
/** @global CMain $APPLICATION */
/** @global CUser $USER */
/** @global CDatabase $DB */
/** @var CBitrixComponentTemplate $this */
/** @var string $templateName */
/** @var string $templateFile */
/** @var string $templateFolder */
/** @var string $componentPath */
/** @var CBitrixComponent $component */
$this->setFrameMode(true);
/*
 * На странице реализована AJAX подгрузка новостей после клика по кноаке ЗАГРУЗИТЬ ЕЩЁ НОВОСТИ
 *
 * Обработчик клика и реализация AJAX запроса в файле script.js соответствующего шаблона
 * /local/templates/.default/components/bitrix/news/news/bitrix/news.list/.default/script.js
 *
 * Компонент собирающий и отдающй данные (новости следующей страницы)
 * реализован в файле get-next-news-page.php
 * /utility/get-next-news-page.php
 *
 * Ссылка для получения данных хранится в параметре href у кнопки ЗАГРУЗИТЬ ЕЩЁ НОВОСТИ
 * При первой загрузке пишем туда адрес первой следующей стрницы
 *
 * !!!Важно:
 * Количество новостей показываемых на одной странице в текущем компоненте
 * должно совпадать с колиеством новостей показываемых на странице в компоненте
 * собирающим данные для следующей страницы (get-next-news-page.php), в компонентах
 * за это отвечает параметр "NEWS_COUNT" => "количество_показываемых_элементов"
 * Либо Инициализируемый адрес для первого запроса должен начинаться со страницы
 * содержащей следующею новость после уже показаной.
 *
 * Для того чтобы компонент отвечающий на асинхонноый запрос отдавал чистые данные JSON
 * в папке его шаблона добален файл component_epilog.php в котором необходимые данные
 * вырезаются из содежания
 * /local/templates/.default/components/bitrix/news.list/ajax-news-list/component_epilog.php
 *
 * $arResult["NAV_RESULT"]->NavPageNomer; - Номер текущей страницы
 * $arResult["NAV_RESULT"]->NavPageCount; - Количество страниц
 * $arResult["NAV_RESULT"]->NavRecordCount; - Общее количество элементов
 * $arResult["NAV_RESULT"]->NavPageSize; - Количество элементов на странице
 */
?>
<div class="page-title">
    <div class="container">
        <h1 class="page-title__content">
            <?$APPLICATION->ShowTitle(false);?>
        </h1>
    </div>
</div>
<div class="container news-list">
    <div class="row news-list__wrap" id="newsListContainer">
        <?foreach($arResult["ITEMS"] as $arItem):?>
            <?
            $this->AddEditAction($arItem['ID'], $arItem['EDIT_LINK'], CIBlock::GetArrayByID($arItem["IBLOCK_ID"], "ELEMENT_EDIT"));
            $this->AddDeleteAction($arItem['ID'], $arItem['DELETE_LINK'], CIBlock::GetArrayByID($arItem["IBLOCK_ID"], "ELEMENT_DELETE"), array("CONFIRM" => GetMessage('CT_BNL_ELEMENT_DELETE_CONFIRM')));
            ?>
            <div class="col-md-6 col-xl-3 d-flex justify-content-center" id="<?=$this->GetEditAreaId($arItem['ID']);?>">
                <a class="news-list__card" href="<?=$arItem["DETAIL_PAGE_URL"]?>">
                    <div class="news-list__pic" style="background-image: url(<?=$arItem['PREVIEW_PICTURE']['SRC']?>);"></div>
                    <div class="news-list__desc">
                        <div class="news-list__date"><?echo $arItem["DISPLAY_ACTIVE_FROM"]?></div>
                        <div class="news-list__caption"><?=$arItem["PREVIEW_TEXT"]?></div>
                    </div>
                </a>
            </div>
        <?endforeach;?>
    </div>
</div>

<?/* Выводим кнопку ЗАГРУЗИТЬ ЕЩЁ только в том случае
   * если номер тукущей страницы меньше
   * общего количества страниц с элементами
   */
if($arResult["NAV_RESULT"]->NavPageNomer < $arResult["NAV_RESULT"]->NavPageCount):?>
    <div class="get-more">
        <div class="container">
            <div class="d-flex justify-content-center page-news">
                <a class="get-more__link"
                   href="/utils/get-next-news-page.php?PAGEN_1=2"
                   id="btnGetNextPage">
                    Загрузить ещё новости
                </a>
            </div>
        </div>
    </div>
<?endif;?>

<?/* Вставка включаемой области Баннер "Купить бетон с доставкой"
   * Внтури родительского контейнера включаемой области /include/buy-concrete.php
   * две дочерние включаемые области /include/buy-concrete-title.php и /include/buy-concrete-txt.php
   * соответственно с заголовком блока и текстом блока
   */
$APPLICATION->IncludeComponent(
    "bitrix:main.include",
    "",
    Array(
        "AREA_FILE_SHOW" => "file",
        "AREA_FILE_SUFFIX" => "inc",
        "EDIT_TEMPLATE" => "",
        "PATH" => "/include/buy-concrete.php"
    )
);?>

<?/* Вставка включаемой области "Вопрос ответ"
   * Путь к включаемой области: /include/faq.php
   * Внутри включаемой области компонент список новостей
   * который выводит список пункутов Вопрос-Ответ из инфоблока
   * Инфоблок Вопрос-Ответ: Инфоблоки->Типы инфоблоков->Контент->Вопрос-Ответ
   */
$APPLICATION->IncludeComponent(
    "bitrix:main.include",
    "",
    Array(
        "AREA_FILE_SHOW" => "file",
        "AREA_FILE_SUFFIX" => "inc",
        "EDIT_TEMPLATE" => "",
        "PATH" => "/include/faq.php"
    )
);?>
