/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2004-2007 1&1 Internet AG, Germany, http://www.1and1.org

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Til Schneider (til132)
     * Sebastian Werner (wpbasti)
     * Andreas Ecker (ecker)
     * Fabian Jakobs (fjakobs)

************************************************************************ */

/* ************************************************************************

#module(apiviewer)

************************************************************************ */

/**
 * Implements the dynamic behaviour of the API viewer.
 */
qx.Class.define("apiviewer.Controller",
{
  extend : qx.core.Object,




  /*
  *****************************************************************************
     CONSTRUCTOR
  *****************************************************************************
  */

  /**
   * @param classViewer {ClassViewer}
   */
  construct : function(widgetRegistry)
  {
    this._widgetRegistry = widgetRegistry;

    this._titlePrefix = qx.core.Setting.get("apiviewer.title") + " API Documentation";
    document.title = this._titlePrefix;

    this._detailLoader = this._widgetRegistry.getWidgetById("detail_loader");
    this._packageViewer = this._widgetRegistry.getWidgetById("package_viewer");

    this._classViewer = this._widgetRegistry.getWidgetById("class_viewer");
    this.__bindClassViewer();

    this._tree = this._widgetRegistry.getWidgetById("tree");
    this.__bindTree();

    this.__bindToolbar();

    this._history = qx.client.History.getInstance();
    this.__bindHistory();

  },


  members :
  {

    /**
     * Loads the API doc tree from a URL. The URL must point to a JSON encoded
     * doc tree.
     *
     * @type member
     * @param url {String} the URL.
     * @return {void}
     */
    load : function(url)
    {
      var req = new qx.io.remote.Request(url);

      req.setTimeout(180000);

      req.addEventListener("completed", function(evt)
      {
        var content = evt.getData().getContent();

        var start = new Date();
        var treeData = eval("(" + content + ")");
        var end = new Date();
        this.debug("Time to eval tree data: " + (end.getTime() - start.getTime()) + "ms");

        // give the browser a chance to update its UI before doing more
        qx.client.Timer.once(function() {
          this.__setDocTree(treeData);

          // Handle bookmarks
          var state = this._history.getState();
          if (state)
          {
            qx.client.Timer.once(function() {
              this.__selectItem(state);
            }, this, 0);
          }

          this._detailLoader.setHtml(
            '<h1><div class="please">' +
            qx.core.Setting.get("apiviewer.title") +
            '</div>API Documentation</h1>'
          );

        }, this, 0);
      },
      this);

      req.addEventListener("failed", function(evt) {
        this.error("Couldn't load file: " + url);
      }, this);

      req.send();
    },


    __bindClassViewer : function()
    {
      this._classViewer.addEventListener("classLinkClicked", function(e) {
        try
        {
          this.__selectItem(e.getData());
        }
        catch(exc)
        {
          this.error("Selecting item '" + itemName + "' failed", exc);
        }
      }, this);
    },


    __bindTree : function()
    {
      this._tree.getManager().addEventListener("changeSelection", function(evt) {
        var treeNode = evt.getData()[0];
        if (treeNode && treeNode.docNode)
        {
          this.__updateHistory(treeNode.docNode.getFullName());
          this.__selectTreeNode(treeNode);
        }
      }, this);

    },


    __bindToolbar : function()
    {
      var btn_inherited = this._widgetRegistry.getWidgetById("btn_inherited");
      btn_inherited.addEventListener("changeChecked", function(e) {
        this._classViewer.setShowInherited(e.getData());
      }, this);

      var btn_protected = this._widgetRegistry.getWidgetById("btn_protected");
      btn_protected.addEventListener("changeChecked", function(e) {
        this._classViewer.setShowProtected(e.getData());
      }, this);

      var btn_private = this._widgetRegistry.getWidgetById("btn_private");
      btn_private.addEventListener("changeChecked", function(e) {
        this._classViewer.setShowPrivate(e.getData());
      }, this);
    },


    __bindHistory : function()
    {
      this._history.addEventListener("request", function(evt) {
        this._tree.selectTreeNodeByClassName(evt.getData())
      }, this);
    },


    /**
     * TODOC
     *
     * @type member
     * @param propValue {var} Current value
     * @param propOldValue {var} Previous value
     * @param propData {var} Property configuration map
     * @return {Boolean} TODOC
     */
    __setDocTree : function(docTree)
    {
      var start = new Date();
      var rootPackage = new apiviewer.dao.Package(docTree);
      var end = new Date();
      this.debug("Time to build data tree: " + (end.getTime() - start.getTime()) + "ms");

      var start = new Date();
      this._tree.setTreeData(rootPackage);
      var end = new Date();
      this.debug("Time to update tree: " + (end.getTime() - start.getTime()) + "ms");

      return true;
    },


    __updateHistory : function(className)
    {
      var newTitle = this._titlePrefix + " - class " + className;
      qx.client.History.getInstance().addToHistory(className, newTitle);
    },


    /**
     * TODOC
     *
     * @type member
     * @param vTreeNode {qx.ui.tree.AbstractTreeElement} TODOC
     * @return {void}
     */
    __selectTreeNode : function(vTreeNode)
    {
      if (!(vTreeNode && vTreeNode.docNode)) {
        this.error("Invalid tree node: " + vTreeNode);
      }

      var vDoc = vTreeNode.docNode;

      this._detailLoader.setVisibility(false);

      if (vDoc instanceof apiviewer.dao.Class)
      {
        this._packageViewer.setVisibility(false);
        this._classViewer.setClassNode(vDoc);
        this._classViewer.setVisibility(true);
      }
      else
      {
        this._classViewer.setVisibility(false);
        this._packageViewer.showInfo(vDoc);
        this._packageViewer.setVisibility(true);
      }
    },


    /**
     * Selects an item (class, property, method or constant).
     *
     * @type member
     * @param fullItemName {String} the full name of the item to select.
     *          (e.g. "qx.mypackage.MyClass" or "qx.mypackage.MyClass#myProperty")
     * @return {void}
     */
    __selectItem : function(fullItemName)
    {
      var className = fullItemName;
      var itemName = null;
      var hashPos = fullItemName.indexOf("#");

      if (hashPos != -1)
      {
        className = fullItemName.substring(0, hashPos);
        itemName = fullItemName.substring(hashPos + 1);

        var parenPos = itemName.indexOf("(");

        if (parenPos != -1) {
          itemName = qx.lang.String.trim(itemName.substring(0, parenPos));
        }
      }

      this._tree.selectTreeNodeByClassName(className);

      if (itemName) {
        this._classViewer.showItem(itemName);
      }
    }

  }

});
