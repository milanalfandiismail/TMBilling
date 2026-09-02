import {
    ClassicEditor,
    Essentials,
    Paragraph,
    Heading,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Alignment,
    FontColor,
    FontBackgroundColor,
    FontSize,
    FontFamily,
    Highlight,
    Link,
    List,
    TodoList,
    Indent,
    IndentBlock,
    BlockQuote,
    CodeBlock,
    Table,
    TableToolbar,
    TableProperties,
    TableCellProperties,
    Image,
    ImageToolbar,
    ImageCaption,
    ImageStyle,
    ImageUpload,
    ImageResize,
    Undo
} from 'ckeditor5';

import 'ckeditor5/ckeditor5.css';

ClassicEditor.builtinPlugins = [
    Essentials, Paragraph, Heading, Bold, Italic, Underline, Strikethrough,
    Alignment, FontColor, FontBackgroundColor, FontSize, FontFamily, Highlight,
    Link, List, TodoList, Indent, IndentBlock, BlockQuote, CodeBlock,
    Table, TableToolbar, TableProperties, TableCellProperties,
    Image, ImageToolbar, ImageCaption, ImageStyle, ImageUpload, ImageResize,
    Undo
];

ClassicEditor.defaultConfig = {
    toolbar: {
        items: [
            'heading', '|',
            'bold', 'italic', 'underline', 'strikethrough', 'highlight', '|',
            'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor', '|',
            'alignment', 'link', 'bulletedList', 'numberedList', 'todoList', 'outdent', 'indent', '|',
            'blockQuote', 'codeBlock', 'insertTable', 'imageUpload', '|',
            'undo', 'redo'
        ]
    },
    image: {
        toolbar: [
            'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
            'toggleImageCaption', 'imageTextAlternative', '|', 'resizeImage'
        ]
    },
    table: {
        contentToolbar: [
            'tableColumn', 'tableRow', 'mergeTableCells',
            'tableProperties', 'tableCellProperties'
        ],
        tableProperties: {
            defaultProperties: {
                borderStyle: 'solid',
                borderColor: '#525252',
                borderWidth: '1px'
            }
        },
        tableCellProperties: {
            defaultProperties: {
                borderStyle: 'solid',
                borderColor: '#525252',
                borderWidth: '1px'
            }
        }
    },
    language: 'en'
};

window.ClassicEditor = ClassicEditor;
