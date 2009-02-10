/* ************************************************************************

   qooxdoo - the new era of web development

   http://qooxdoo.org

   Copyright:
     2004-2009 1&1 Internet AG, Germany, http://www.1und1.de

   License:
     LGPL: http://www.gnu.org/licenses/lgpl.html
     EPL: http://www.eclipse.org/org/documents/epl-v10.php
     See the LICENSE file in the project's top-level directory for details.

   Authors:
     * Fabian Jakobs (fjakobs)

************************************************************************ */

/**
 * The CellSpanManager manages cells, which span several rows or columns.
 * 
 * It provides functionality to compute, which spanning cells are visible
 * in a given view port and how they have to be placed.
 */
qx.Class.define("qx.ui.virtual.layer.CellSpanManager",
{
  extend : qx.core.Object,
  
  /**
   * @param rowConfig {qx.ui.virtual.core.Axis} The row configuration of the pane 
   *    in which the cells will be rendered
   * @param columnConfig {qx.ui.virtual.core.Axis} The column configuration of the pane 
   *    in which the cells will be rendered
   */
  construct : function(rowConfig, columnConfig)
  {
    this.base(arguments);  
    
    if (qx.core.Variant.isSet("qx.debug", "on")) 
    {
      this.assertInstance(rowConfig, qx.ui.virtual.core.Axis);
      this.assertInstance(columnConfig, qx.ui.virtual.core.Axis);
    }    
    
    this._cells = {};
    this._invalidateSortCache();
    this._invalidatePositionCache();
    
    rowConfig.addListener("change", this._onRowConfigChange, this);
    columnConfig.addListener("change", this._onColumnConfigChange, this);
    
    this._rowConfig = rowConfig;
    this._columnConfig = columnConfig;    
  },
  
  
  /*
  *****************************************************************************
     MEMBERS
  *****************************************************************************
  */

  members :
  {    
    /**
     * Add a spanning cell to the manager.
     * 
     * @param id {String} Unique id for the cell definition. This id is required
     *    for removing the cell from the manager
     * @param row {PositiveInteger} The cell's row
     * @param column {PositiveInteger} The cell's column
     * @param rowSpan {PositiveInteger} The number of rows the cells spans
     * @param columnSpan {PositiveInteger} The number of columns the cells spans
     */
    addCell : function(id, row, column, rowSpan, columnSpan)
    {
      this._cells[id] = {
        firstRow: row,
        lastRow : row + rowSpan - 1,
        firstColumn: column,
        lastColumn: column + columnSpan - 1,
        id: id
      }
      this._invalidateSortCache();
    },
     
     
    /**
     * Remove a cell from the manager
     * 
     * @param id {String} The id of the cell to remove
     */
    removeCell : function(id)
    {
      delete(this._cells[id]);
      this._invalidateSortCache();
    },
         
     
    /**
     * Invalidate the sort cache
     */
    _invalidateSortCache : function() {
      this._sorted = {};
    },
     
     
    /**
     * Get the cell array sorted by the given key (ascending)
     * 
     * @param key {String} The sort key. One of <code>firstRow</code>,
     *     <code>lastRow</code>, <code>firstColumn</code> or <code>lastColumn</code>
     * @return {Map[]} sorted array of cell descriptions
     */
    _getSortedCells : function(key)
    {
      if (this._sorted[key]) {
        return this._sorted[key];
      }
      var sorted = this._sorted[key] = qx.lang.Object.getValues(this._cells);
      sorted.sort(function(a, b) {
        return a[key] < b[key] ? -1 : 1;
      });
      return sorted;
    },     
     
    
    /**
     * Finds all cells with a sort key within the given range. The result is
     * added to the result map
     * 
     * Complexity: O(log n)
     * 
     * @param result {Map} Map, which will contain the search results
     * @param key {String} The key to search for
     * @param min {Integer} minimum value 
     * @param max {Integer} maximum value (inclusive)
     */
    _findCellsInRange : function(result, key, min, max)
    {
      var cells = this._getSortedCells(key);
      if (cells.length == 0) {
        return;
      }
       
      var start = 0;
      var end = cells.length-1;            
      
      // find first cell, which is >= "min"
      while (true) 
      {
        var pivot = start + ((end - start) >> 1);
        
        var cell = cells[pivot];
        if (
          cell[key] >= min &&
          (pivot == 0 || cells[pivot-1][key] < min)
        ) {
          // the start cell was found
          break;
        }
        
        if (cell[key] >= min) {
          end = pivot - 1;
        } else {
          start = pivot + 1; 
        }
        if (start > end) {
          // nothing found
          return;
        }
      }       
       
      var cell = cells[pivot];
      while (cell && cell[key] >= min && cell[key] <= max)
      {
        result[cell.id] = cell;
        cell = cells[pivot++];
      }       
    },
     
       
    /**
     * Find all cells, which are visible in the given grid window.
     * 
     * @param firstRow {PositiveInteger} first visible row
     * @param lastRow {PositiveInteger} last visible row
     * @param firstColumn {PositiveInteger} first visible column
     * @param lastColumn {PositiveInteger} last visible column
     * @return {Map[]} The array of found cells descriptions. A cell description
     *    contains the keys <code>firstRow</code>, <code>lastRow</code>,
     *    <code>firstColumn</code> or <code>lastColumn</code>
     */
    findCellsInWindow : function(firstRow, lastRow, firstColumn, lastColumn) 
    {
      var horizontalInWindow = {};
      this._findCellsInRange(horizontalInWindow, "firstColumn", firstColumn, lastColumn);
      this._findCellsInRange(horizontalInWindow, "lastColumn", firstColumn, lastColumn);
       
      var verticalInWindow = {};
      this._findCellsInRange(verticalInWindow, "firstRow", firstRow, lastRow);
      this._findCellsInRange(verticalInWindow, "lastRow", firstRow, lastRow);
       
      var cells = [];
      // intersect
      for (var id in verticalInWindow)
      {
        if (horizontalInWindow[id]) {
          cells.push(horizontalInWindow[id]);
        }
      }
      return cells;
    },     
    

    /**
     * Event handler for row configuration changes
     * 
     * @param e {qx.event.type.Event} the event object
     */
    _onRowConfigChange : function(e) {
      this._rowPos = [];
    },    
    
    
    /**
     * Event handler for column configuration changes
     * 
     * @param e {qx.event.type.Event} the event object
     */
    _onColumnConfigChange : function(e) {
      this._columnPos = [];
    },

    
    /**
     * Invalidates the row/column position cache
     */    
    _invalidatePositionCache : function()
    {
      this._rowPos = [];
      this._columnPos = [];
    },
    
    
    /**
     * Get the pixel start position of the given row
     * 
     * @param row {Integer} The row index
     * @return {Integer} The pixel start position of the given row
     */
    _getRowPosition : function(row)
    {
      var pos = this._rowPos[row]; 
      if (pos !== undefined) {
        return pos;
      }

      pos = this._rowPos[row] = this._rowConfig.getItemPosition(row);
      return pos;
    },
    
    
    /**
     * Get the pixel start position of the given column
     * 
     * @param column {Integer} The column index
     * @return {Integer} The pixel start position of the given column
     */    
    _getColumnPosition : function(column)
    {
      var pos = this._columnPos[column]; 
      if (pos !== undefined) {
        return pos;
      }
      
      pos = this._columnPos[column] = this._columnConfig.getItemPosition(column);
      return pos;
    },    
    
    
    /**
     * Get the bounds of a single cell
     * 
     * @param cell {Map} the cell description as returned by 
     *    {@link #findCellsInWindow} to get the bounds for
     * @param firstVisibleRow {Map} The pane's first visible row
     * @param firstVisibleColumn {Map} The pane's first visible column 
     */
    _getSingleCellBounds : function(cell, firstVisibleRow, firstVisibleColumn)
    {
      var bounds = {
        left: 0,
        top: 0,
        width: 0,
        height: 0
      }
     
      bounds.height = 
        this._getRowPosition(cell.lastRow) + 
        this._rowConfig.getItemSize(cell.lastRow) -
        this._getRowPosition(cell.firstRow);
      
      bounds.top = 
        this._getRowPosition(cell.firstRow) -
        this._getRowPosition(firstVisibleRow);
      
      bounds.width = 
        this._getColumnPosition(cell.lastColumn) + 
        this._columnConfig.getItemSize(cell.lastColumn) -
        this._getColumnPosition(cell.firstColumn);
      
      bounds.left = 
        this._getColumnPosition(cell.firstColumn) -
        this._getColumnPosition(firstVisibleColumn);
      
      return bounds;
    },
    
    
    /**
     * Get the bounds of a list of cells as returned by {@link findCellsInWindow}
     * 
     * @param cells {Map[]} Array of cell descriptions
     * @param firstVisibleRow {Map} The pane's first visible row
     * @param firstVisibleColumn {Map} The pane's first visible column
     * @return {Map[]} Array, which contains a bounds map for each cell. 
     */
    getCellBounds : function(cells, firstVisibleRow, firstVisibleColumn)
    {
      var bounds = [];      
      for (var i=0, l=cells.length; i<l; i++)
      {
        bounds.push(this._getSingleCellBounds(
          cells[i], firstVisibleRow, firstVisibleColumn)
        )
      }
      return bounds;
    },
    
    
    /**
     * Compute a bitmap, which marks for each visible cell, whether the cell
     * is covered by a spanning cell.
     * 
     * @param cells {Map[]} Array of cell descriptions as returned by
     *     {@link findCellsInWindow}.
     * @param firstRow {PositiveInteger} first visible row
     * @param lastRow {PositiveInteger} last visible row
     * @param firstColumn {PositiveInteger} first visible column
     * @param lastColumn {PositiveInteger} last visible column
     * @return {Map[][]} Two dimensional array, which contains a <code>1</code>
     *    for each visible cell, which is covered by a spanned cell. 
     */
    computeCellSpanMap : function(cells, firstRow, lastRow, firstColumn, lastColumn)
    {
      var map = [];
      for (var i=firstRow; i<= lastRow; i++) {
        map[i] = [];
      }
      
      for (var i=0, l=cells.length; i<l; i++)
      {
        var cell = cells[i];
        
        var rowStartIndex = Math.max(firstRow, cell.firstRow);
        var rowEndIndex = Math.min(lastRow, cell.lastRow);
        
        for (var rowIndex=rowStartIndex; rowIndex <= rowEndIndex; rowIndex++)
        {
          row = map[rowIndex];

          var columnStartIndex = Math.max(firstColumn, cell.firstColumn);
          var columnEndIndex = Math.min(lastColumn, cell.lastColumn);
          for (var columnIndex=columnStartIndex; columnIndex <= columnEndIndex; columnIndex++)
          {
            row[columnIndex] = 1;
          }
        }
      }
      
      return map;
    }
  },
  
  
  destruct : function()
  {
    this._rowConfig.removeListener("change", this._onRowConfigChange, this);
    this._columnConfig.removeListener("change", this._onColumnConfigChange, this);
    
    this._disposeFields(
      "_cells", "_sorted", "_rowPos", "_columnPos",
      "_rowConfig", "_columnConfig"
    );    
  }
});