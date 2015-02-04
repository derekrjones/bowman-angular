# bowman-angular

## Angular plugin for Bowman

- adds `angular` property to list all angular modules and dependencies

## install

`npm install bowman-angular --save`

## usage

```javascript
// bower.json
"bowman": {
  "plugins": [
    "bowman-angular"
  ]
}
```

## example

```javascript
// .bowman.json
"angular-ui-router": {
  "name": "angular-ui-router",
  "repository": "angular-ui/ui-router",
  /* ... */
  "angular": {
    "ui.router.util": [
      "ng"
    ],
    "ui.router.router": [
      "ui.router.util"
    ],
    "ui.router.state": [
      "ui.router.router",
      "ui.router.util"
    ],
    "ui.router": [
      "ui.router.state"
    ],
    "ui.router.compat": [
      "ui.router"
    ]
  }
}
```
