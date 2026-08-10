## In This Article

* [Setting Up the Project](#setting-up-the-project)
* [Getting Started](#getting-started)
* [Serving in Development Mode](#serving-in-development-mode)
* [Build for Production](#build-for-production)
* [Kendo UI License Activation](#kendo-ui-license-activation)
* [Kendo UI Components Upgrade](#kendo-ui-components-upgrade)
* [Adding-New-Kendo-UI-Components](#adding-new-kendo-ui-components)

## Setting Up the Project

Currently, the project runs with:
- Angular v17.0.0
- Angular-CLI v17.0.0

## Getting Started

1. Clone the repository locally by running `git clone https://github.com/Con-Edison-Emu/egis-maps-app`.
2. Navigate to the project folder by running `cd /egis-maps-app`.
3. Install dependencies with NPM by running `npm install`.

## Serving in Development Mode

1. Modify apiUrl and other configurations in asets/json/ files
2. In the terminal window, run the project with `ng serve` for a dev server.
3. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Build for Production

Run `ng build --configuration production --base-href ./` to run the project in production mode.

## Kendo UI License Activation
Download the new license key from telerik site
Copy the kendo-ui-license.txt license key file to the root folder of your application. This is the folder that contains the package.json file. 
Delete the .angular/cache folder in project.
run the command npm install --save @progress/kendo-licensing
run the command npx kendo-ui-license activate

## Kendo UI Components Upgrade
To upgrade all Progress packages, run the command npx npm-check-updates --upgrade --filter "/@progress.*/"
Run the command npm install to install new versions

## Adding-New-Kendo-UI-Components
run the command ng add @progress/'kendoui component name'


