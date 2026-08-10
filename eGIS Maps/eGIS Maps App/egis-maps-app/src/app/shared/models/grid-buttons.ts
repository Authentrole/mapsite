import { IGridButtonConfig } from "../interfaces/grid-button-config.interface";

export class GridButtonConfig implements IGridButtonConfig {
    id: string | undefined;
    text: string | undefined;
    icon:any;
    toggle_icon?: any;
    tooltip: string | undefined;
    default_action?: boolean | undefined;
    component?: any;
    checkForActive?: boolean | undefined;
    checkForVisibility?: boolean | undefined;
    showText?: boolean | undefined;
    
}

export class GridButtons {
    ActionButtons:GridButtonConfig[] = [];
    ToolbarButtons:GridButtonConfig[] = [];

    
    constructor() {
        this.ActionButtons = [
            {
                id: 'open', 
                text: 'Open',
                icon: "hyperlink-open-sm",
                tooltip: "Open | Report",
                checkForActive: true
            },
             {
                id: 'overview', 
                text: 'Overview',
                icon: "hyperlink-open-sm",
                tooltip: "| Overview",
                checkForActive: true
            },
            {
                id: 'edit', 
                text: 'Edit',
                icon: "pencil",
                tooltip: "Edit |"
            },
            {
                id: 'delete', 
                text: 'Delete',
                icon: "close-outline",
                tooltip: "Delete |",
                checkForActive: true
            },
            {
                id: 'deactivate', 
                text: 'De-Activate',
                icon: "close-outline",
                tooltip: "De-Activate |",
                checkForActive: true
            },
            {
                id: 'history', 
                text: 'History',
                icon: "js",
                tooltip: "Show History"
            },
            {
                id: 'attachment', 
                text: 'Attachment',
                icon: "paperclip",
                tooltip: "Show Attachments",
                checkForVisibility: true
            },
            {
                id: 'upgrade', 
                text: 'Upgrade',
                icon: "upgrade-outline",
                tooltip: "Upgrade Incident"
            },
            {
                id: 'jobaid',
                text: 'Job Aids',
                icon: "book",
                tooltip: "View Job Aids"
            },
             {
                id: 'copy', 
                text: 'Copy',
                icon: "copy",
                tooltip: "Copy |"
            },

        ];

        this.ToolbarButtons = [
            {
                id: 'refresh', 
                text: 'Refresh',
                icon: "refresh",
                tooltip: "Refresh Data"
            },
            {
                id: 'add', 
                text: 'Add',
                icon: "plus",
                tooltip: "Add |"
            },
            {
                id: 'edit', 
                text: 'Edit',
                icon: "pencil",
                tooltip: "Edit |"
            },
            {
                id: 'clear', 
                text: 'Clear',
                icon: "ilter-clear",
                tooltip: "Clear Filters",
                default_action:true
            },
            {
                id: 'xlexport', 
                text: 'XL Export',
                icon: "file-excel",
                tooltip: "Export to XL",
                default_action:true
            },
            {
                id: 'pptexport', 
                text: 'PPT ',
                icon: "file-ppt",
                tooltip: "Export to PPT"
            },
            {
                id: 'pdfexport', 
                text: 'PDF Export',
                icon: "file-pdf",
                tooltip: "Export to PDF"
            },
            {
                id: 'favorite', 
                text: 'Favorite',
                icon: "star-outline",
                toggle_icon:"star",
                tooltip: "Toggle Favorites"
            },
            {
                id: 'patch', 
                text: 'Patch',
                icon: "gears",
                tooltip: "Patch Server(s)"
            },
            {
                id: 'decommission', 
                text: 'Decommission',
                icon: "close-outline",
                tooltip: "Decommission / Activate Server(s)"
            },
            {
                id: 'upload', 
                text: 'Upload',
                icon: "upgrade-outline",
                tooltip: "Upload | Items"
            },
        ]
    }
}

