$( function () {
	var taskTypeTemplateMapping = {},
		lang = $( 'html' ).attr( 'lang' ),
		maxResultsinUi = 10,
		apiQueryCount = 0,
		langSelectWidget = new OO.ui.ButtonSelectWidget( {
			items: [
				new OO.ui.ButtonOptionWidget( {
					data: 'cs',
					label: 'cs'
				} ),
				new OO.ui.ButtonOptionWidget( {
					data: 'ar',
					label: 'ar'
				} ),
				new OO.ui.ButtonOptionWidget( {
					data: 'ko',
					label: 'ko'
				} )
			]
		} ),
		resultCount = 0,
		info = new OO.ui.MessageWidget( {
			type: 'notice',
			label: 'Task detail',
			classes: [ 'task-info' ]
		} ).toggle( false ),
		$wrapper = $( '.wrapper' ),
		$resultCountHtml = $( '<p>' ).addClass( 'result-count' ),
		$queryCountHtml = $( '<p>' ).addClass( 'query-count' ),
		taskTypeWidget = new OO.ui.CheckboxMultiselectWidget( {
			classes: [ 'task-type' ],
			items: []

		} ),
		hasTemplate = [],
		srSearch = '',
		list = new OO.ui.SelectWidget( {
			classes: [ 'newcomer-tasks' ]
		} ),
		queryParams = {
			action: 'query',
			format: 'json',
			formatversion: 2,
			generator: 'search',
			gsrnamespace: 0,
			gsrwhat: 'text',
			gsrprop: 'snippet',
			gsrqiprofile: 'classic_noboostlinks',
			origin: '*'
		},
		TaskOptionWidget = function ( config ) {
			config = config || {};
			TaskOptionWidget.parent.call( this, config );
			this.template = config.template;
			this.category = config.category;
		},
		searchWidget = new OO.ui.SearchInputWidget();

	OO.inheritClass( TaskOptionWidget, OO.ui.OptionWidget );

	TaskOptionWidget.prototype.getTemplate = function () {
		return this.template;
	};



	function getCategoryForTemplate( template ) {
		var category;
		for ( category in taskTypeTemplateMapping ) {
			if ( taskTypeTemplateMapping[ category ].templates.indexOf( template ) !== -1 ) {
				return category;
			}
		}
	}

	function getCategoryLabelForTemplate( template ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( template ) ].label;
	}

	function appendResultsToTaskOptions( searchResult, template ) {

		if ( list.findItemFromData( searchResult ) === null ) {
			resultCount += 1;
			if ( resultCount < maxResultsinUi ) {
				list.addItems( [
					new TaskOptionWidget( {
						data: searchResult,
						template: template,
						label: searchResult.title
					} )
				] );
			}
		}
	}

	function executeQuery( offset, template ) {
		apiQueryCount += 1;
		if ( offset !== 0 ) {
			queryParams.sroffset = offset;
		}
		$.get( 'https://' + lang + '.wikipedia.org/w/api.php?', queryParams )
			.then( function ( result ) {
				if ( result.query ) {
					result.query.pages.forEach(function (searchResult) {
						appendResultsToTaskOptions(searchResult, template);
					} );
				}
				$wrapper.find( '.result-count' )
					.text( resultCount + ' results found' );
				$wrapper.find( '.query-count' )
					.text( apiQueryCount + ' API queries executed' );
				if ( result.continue ) {
					executeQuery( result.continue.sroffset, template );
				}
			}, function ( err ) {
				console.log( err );
			} );
	}

	function updateQueryParams() {
		srSearch = '';
		info.toggle( false );
		list.clearItems();
		list.toggle( true );
		resultCount = 0;
		apiQueryCount = 0;
		$wrapper.find( '.result-count' ).toggle( true );
		$wrapper.find( '.query-count' ).toggle( true );
		$wrapper.find( '.query-debug' ).text( '' );
		if ( !hasTemplate.length ) {
			delete queryParams.srsearch;
			return;
		}
		if ( searchWidget.getValue().length ) {
			srSearch = '"' + searchWidget.getValue() + '"';
		}
		hasTemplate.flat().forEach( function ( template ) {
			var perTemplateQuery = queryParams,
				perTemplateSrSearch = 'hastemplate:"' + template + '" ' + srSearch.trim();
			$.extend( perTemplateQuery, { gsrsearch: perTemplateSrSearch.trim() } );
			$wrapper.find( '.query-debug' )
				.append( '<br />' )
				.append( JSON.stringify( perTemplateQuery, null, 2 ) );
			executeQuery( 0, template );
		} );

	}

	searchWidget.on( 'change', $.debounce( 250, updateQueryParams ) );

	function getIconForTemplate( templateName ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( templateName ) ].icon;
	}

	list.on( 'choose', function ( item ) {
		info.toggle( true );
		info.setLabel(
			new OO.ui.HtmlSnippet(
				'<strong><a href="https://' + lang + '.wikipedia.org/wiki/' + item.data.title + '">' + item.data.title + '</a></strong>' +
				'<br>' +
				item.data.gsrsnippet +
			'<br>' +
			'<p><strong>Template:</strong> ' + item.getTemplate() + ' ' +
			'<strong>Category:</strong> ' + getCategoryLabelForTemplate( item.getTemplate() ) + '</p>' )
		);
		info.setIcon( getIconForTemplate( item.getTemplate() ) );
	} );

	function getTemplatesForLang( lang ) {
		taskTypeWidget.clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			titles: 'User:KHarlan_(WMF)/newcomertasks/templates/' + lang + '.json',
			action: 'query',
			prop: 'revisions',
			rvprop: 'content',
			format: 'json',
			formatversion: 2,
			rvslots: '*',
			origin: '*'
		}, function ( response ) {
			var templates = JSON.parse(
					response.query.pages[ 0 ].revisions[ 0 ].slots.main.content
				),
				key;

			for ( key in templates ) {
				taskTypeWidget.addItems( [ new OO.ui.CheckboxMultioptionWidget( {
					data: templates[ key ].templates,
					label: templates[ key ].label
				} ) ] );
				taskTypeTemplateMapping[ key ] = templates[ key ];
			}
		} );
	}

	langSelectWidget.on( 'select', function ( item ) {
		$( 'html' ).attr( 'lang', item.data );
		lang = item.data;
		hasTemplate = [];
		getTemplatesForLang( lang );
		updateQueryParams();
	} );

	taskTypeWidget.on( 'select', function () {
		hasTemplate = [];
		taskTypeWidget.getItems().forEach( function ( item ) {
			if ( item.selected ) {
				hasTemplate.push( item.data );
			}
		} );
		if ( hasTemplate.length ) {
			updateQueryParams();
		} else {
			// No templates, hide the results.
			list.toggle( false );
			$wrapper.find( '.result-count' ).toggle( false );
			$wrapper.find( '.query-count' ).toggle( false );
		}
	} );

	$wrapper.append(
		langSelectWidget.$element,
		taskTypeWidget.$element,
		searchWidget.$element,
		info.$element,
		$resultCountHtml,
		$queryCountHtml,
		list.$element
	);
} );
