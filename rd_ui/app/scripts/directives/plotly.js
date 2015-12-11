(function () {
  'use strict';

  var ColorPalette = {
    'Blue': '#4572A7',
    'Red': '#AA4643',
    'Green': '#89A54E',
    'Purple': '#80699B',
    'Cyan': '#3D96AE',
    'Orange': '#DB843D',
    'Light Blue': '#92A8CD',
    'Lilac': '#A47D7C',
    'Light Green': '#B5CA92',
    'Brown': '#A52A2A',
    'Black': '#000000',
    'Gray': '#808080',
    'Pink': '#FFC0CB',
    'Dark Blue': '#00008b'
  };
  var ColorPaletteArray = _.values(ColorPalette)

  var fillXValues = function(seriesList) {
    var xValues = _.uniq(_.flatten(_.pluck(seriesList, 'x')));
    xValues.sort();
    _.each(seriesList, function(series) {
      series.x.sort();
      _.each(xValues, function(value, index) {
        if (series.x[index] != value) {
          series.x.splice(index, 0, value);
          series.y.splice(index, 0, 0);
        }
      });
    });
  }

  var normalAreaStacking = function(seriesList) {
    fillXValues(seriesList);
    for (var i = 1; i < seriesList.length; i++) {
      for (var j = 0; j < seriesList[i].y.length; j++) {
        seriesList[i].y[j] += seriesList[i-1].y[j];
      }
    }
  }

  var percentAreaStacking = function(seriesList) {
    if (seriesList.length == 0)
      return;
    fillXValues(seriesList);
    _.each(seriesList, function(series) {
      series.text = [];
    });
    for (var i = 0; i < seriesList[0].y.length; i++) {
      var sum = 0;
      for(var j = 0; j < seriesList.length; j++) {
        sum += seriesList[j]['y'][i];
      }
      for(var j = 0; j < seriesList.length; j++) {
        seriesList[j].text.push('Value: ' + seriesList[j]['y'][i]);
        seriesList[j]['y'][i] = seriesList[j]['y'][i] / sum * 100;
        if (j > 0)
          seriesList[j].y[i] += seriesList[j-1].y[i];
      }
    }
  }

  var percentBarStacking = function(seriesList) {
    if (seriesList.length == 0)
      return;
    fillXValues(seriesList);
    _.each(seriesList, function(series) {
      series.text = [];
    });
    for (var i = 0; i < seriesList[0].y.length; i++) {
      var sum = 0;
      for(var j = 0; j < seriesList.length; j++) {
        sum += seriesList[j]['y'][i];
      }
      for(var j = 0; j < seriesList.length; j++) {
        seriesList[j].text.push('Value: ' + seriesList[j]['y'][i]);
        seriesList[j]['y'][i] = seriesList[j]['y'][i] / sum * 100;
      }
    }
  }

  var normalizeValue = function(value) {
    if (moment.isMoment(value)) {
      return value.format("YYYY-MM-DD HH:MM:SS.ssssss");
    }
    return value;
  }

  angular.module('plotly-chart', [])
    .constant('ColorPalette', ColorPalette)
    .directive('plotlyChart', function () {
      return {
        restrict: 'E',
        template: '<plotly data="data" layout="layout" options="plotlyOptions"></plotly>',
        scope: {
          options: "=",
          series: "=",
          minHeight: "="
        },
        link: function (scope, element, attrs) {
          var getScaleType = function(scale) {
            if (scale == 'datetime')
              return 'date';
            if (scale == 'logarithmic')
              return 'log';
            return scale;
          }

          var setType = function(series, type) {
            if (type == 'column') {
              series['type'] = 'bar';
            } else  if (type == 'line') {
              series['mode'] = 'lines';
            } else if (type == 'area') {
              series['fill'] = scope.options.series.stacking == null ? 'tozeroy' : 'tonexty';
              series['mode'] = 'lines';
            } else if (type == 'scatter') {
              series['type'] = 'scatter';
              series['mode'] = 'markers';
            }
          }

          var getColor = function(index) {
            return ColorPaletteArray[index % ColorPaletteArray.length];
          }

          var bottomMargin = 50,
              pixelsPerLegendRow = 21;
          var redraw = function() {
            scope.data.length = 0;
            scope.layout.showlegend = _.has(scope.options, 'legend') ? scope.options.legend.enabled : true;
            scope.layout.height = Math.max(scope.minHeight, pixelsPerLegendRow * scope.series.length);
            scope.layout.margin.b = scope.layout.height - (scope.minHeight - bottomMargin) ;
            delete scope.layout.barmode;
            delete scope.layout.xaxis;
            delete scope.layout.yaxis;
            delete scope.layout.yaxis2;

            if (scope.options.globalSeriesType == 'pie') {
              var hasX = _.contains(_.values(scope.options.columnMapping), 'x');
              var rows = scope.series.length > 2 ? 2 : 1;
              var cellsInRow = Math.ceil(scope.series.length / rows)
              var cellWidth = 1 / cellsInRow;
              var cellHeight = 1 / rows;
              var xPadding = 0.02;
              var yPadding = 0.05;
              _.each(scope.series, function(series, index) {
                var xPosition = (index % cellsInRow) * cellWidth;
                var yPosition = Math.floor(index / cellsInRow) * cellHeight;
                var plotlySeries = {values: [], labels: [], type: 'pie', hole: .4,
                                    text: series.name, textposition: 'inside', name: series.name,
                                    domain: {x: [xPosition, xPosition + cellWidth - xPadding],
                                             y: [yPosition, yPosition + cellHeight - yPadding]}};
                _.each(series.data, function(row, index) {
                  plotlySeries.values.push(row.y);
                  plotlySeries.labels.push(hasX ? row.x : 'Slice ' + index);
                });
                scope.data.push(plotlySeries);
              });
              return;
            }

            var hasY2 = false;
            _.each(scope.series, function(series, index) {
              var seriesOptions = scope.options.seriesOptions[series.name] || {};
              var plotlySeries = {x: [],
                                  y: [],
                                  name: seriesOptions.name || series.name,
                                  marker: {color: seriesOptions.color ? seriesOptions.color : getColor(index)}};
              if (seriesOptions.yAxis == 1 && scope.options.series.stacking == null) {
                hasY2 = true;
                plotlySeries.yaxis = 'y2';
              }
              setType(plotlySeries, seriesOptions.type);
              var data = series.data;
              if (scope.options.sortX) {
                data = _.sortBy(data, 'x');
              }
              _.each(data, function(row) {
                plotlySeries.x.push(normalizeValue(row.x));
                plotlySeries.y.push(normalizeValue(row.y));
              });
              scope.data.push(plotlySeries)
            });

            var getTitle = function(axis) {
              if (angular.isDefined(axis) && angular.isDefined(axis.title)) {
                return axis.title.text;
              }
              return null;
            }

            scope.layout.xaxis = {title: getTitle(scope.options.xAxis),
                                  type: getScaleType(scope.options.xAxis.type)};
            if (angular.isDefined(scope.options.xAxis.labels)) {
              scope.layout.xaxis.showticklabels = scope.options.xAxis.labels.enabled;
            }
            if (angular.isArray(scope.options.yAxis)) {
              scope.layout.yaxis = {title: getTitle(scope.options.yAxis[0]),
                                    type: getScaleType(scope.options.yAxis[0].type)};
            }
            if (hasY2 && angular.isDefined(scope.options.yAxis)) {
              scope.layout.yaxis2 = {title: getTitle(scope.options.yAxis[1]),
                                     type: getScaleType(scope.options.yAxis[1].type),
                                     overlaying: 'y',
                                     side: 'right'};
            } else {
              delete scope.layout.yaxis2;
            }
            if (scope.options.series.stacking == 'normal') {
              scope.layout.barmode = 'stack';
              if (scope.options.globalSeriesType == 'area') {
                normalAreaStacking(scope.data);
              }
            } else if (scope.options.series.stacking == 'percent') {
              scope.layout.barmode = 'stack';
              if (scope.options.globalSeriesType == 'area') {
                percentAreaStacking(scope.data);
              } else if (scope.options.globalSeriesType == 'column') {
                percentBarStacking(scope.data);
              }
            }
          }

          scope.$watch('series', redraw);
          scope.$watch('options', redraw, true);
          scope.layout = {margin: {l: 50, r: 50, b: 50, t: 20, pad: 4}, autosize: true};
          scope.plotlyOptions = {showLink: false, displaylogo: false};
          scope.data = [];
        }
      }
    });
})();
