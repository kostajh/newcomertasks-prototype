$( function () {
	var taskTypeTemplateMapping = {},
		lang = $( 'html' ).attr( 'lang' ),
		queryLimit = 25,
		apiQueryCount = 0,
		searchProfileHelp = new OO.ui.PopupButtonWidget( {
			icon: 'info',
			framed: false,
			label: 'More information',
			invisibleLabel: true,
			popup: {
				head: true,
				label: 'More information',
				$content: $( '<p>See srqiprofile <a href="https://www.mediawiki.org/wiki/API:Search">here</a></p>' ),
				padded: true,
				align: 'forwards'
			}
		} ),
		searchProfileWidget = new OO.ui.DropdownWidget( {
			label: 'srqiprofile',
			menu: {
				items: [
					new OO.ui.MenuOptionWidget( {
						data: 'classic',
						label: 'classic'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'classic_noboostlinks',
						label: 'classic_noboostlinks',
						selected: true
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'empty',
						label: 'empty'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'wsum_inclinks',
						label: 'wsum_inclinks'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'wsum_inclinks_pv',
						label: 'wsum_inclinks_pv'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'popular_inclinks_pv',
						label: 'popular_inclinks_pv'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'popular_inclinks',
						label: 'popular_inclinks'
					} ),
					new OO.ui.MenuOptionWidget( {
						data: 'engine_autoselect',
						label: 'engine_autoselect'
					} )
				]
			}
		} ),
		moreLikeOverrideWidget = new OO.ui.ButtonWidget( {
			label: null,
			flags: [
				'progressive'
			]
		} ).toggle( false ),
		helpWidget = new OO.ui.PopupButtonWidget( {
			icon: 'info',
			framed: false,
			label: 'More information',
			invisibleLabel: true,
			popup: {
				head: true,
				label: null,
				$content: $(
					'<p>Topics are editable at https://www.mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/topics/{langCode}.json</p>' +
					'<p>Templates (task types) are editable at https://www.mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/templates/{langCode}.json</p>'
				),
				padded: true,
				align: 'force-right'
			}
		} ),
		resetButton = new OO.ui.ButtonWidget( {
			label: 'Reset',
			flags: [
				'primary',
				'destructive'
			]
		} ),
		searchButton = new OO.ui.ButtonWidget( {
			label: 'Search',
			disabled: true,
			flags: [
				'primary',
				'progressive'
			]
		} ),
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
				} ),
				new OO.ui.ButtonOptionWidget( {
					data: 'vi',
					label: 'vi'
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
		moreLike = [],
		srSearch = '',
		list = new OO.ui.SelectWidget( {
			classes: [ 'newcomer-tasks' ]
		} ),
		queryParams = {
			action: 'query',
			format: 'json',
			list: 'search',
			srlimit: queryLimit,
			srnamespace: 0,
			srqiprofile: 'classic_noboostlinks',
			origin: '*'
		},
		TaskOptionWidget = function ( config ) {
			config = config || {};
			TaskOptionWidget.parent.call( this, config );
			this.template = config.template;
			this.category = config.category;
		},
		topicWidget,
		controls,
		TopicSelectionWidget = function ( config ) {
			config = config || {};
			TopicSelectionWidget.parent.call( this, config );
		};

	OO.inheritClass( TaskOptionWidget, OO.ui.OptionWidget );
	OO.inheritClass( TopicSelectionWidget, OO.ui.MenuTagMultiselectWidget );

	TaskOptionWidget.prototype.getTemplate = function () {
		return this.template;
	};

	topicWidget = new TopicSelectionWidget( {
		allowArbitrary: false,
		options: [],
		disabled: true
	} );

	controls = new OO.ui.FieldsetLayout( {
		label: null,
		items: [
			new OO.ui.FieldLayout(
				new OO.ui.Widget( {
					content: [
						new OO.ui.HorizontalLayout( {
							items: [
								helpWidget, langSelectWidget, topicWidget, taskTypeWidget
							]
						} )
					]
				} )
			),
			new OO.ui.FieldLayout(
				new OO.ui.Widget( {
					content: [
						new OO.ui.HorizontalLayout( {
							items: [
								searchProfileHelp, searchProfileWidget
							]
						} )
					]
				} )
			),
			new OO.ui.FieldLayout(
				new OO.ui.Widget( {
					content: [
						new OO.ui.HorizontalLayout( {
							items: [ searchButton, resetButton, moreLikeOverrideWidget ]
						} )
					]
				} ) )
		]
	} );

	// TODO:
	// [] freetext search mode
	// [] Override morelike

	function getTopicsForLang( lang ) {
		topicWidget.clearItems();
		topicWidget.getMenu().clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			action: 'query',
			prop: 'revisions',
			titles: 'Growth/Personalized_first_day/Newcomer_tasks/Prototype/topics/' + lang + '.json',
			rvprop: 'content',
			format: 'json',
			formatversion: 2,
			rvslots: '*',
			origin: '*'
		}, function ( response ) {
			var topics = JSON.parse( response.query.pages[ 0 ].revisions[ 0 ].slots.main.content ),
				key;
			for ( key in topics ) {
				topicWidget.addOptions( [
					topicWidget.createMenuOptionWidget( topics[ key ].titles, topics[ key ].label, '' )
				] );
			}
		} );
	}

	function getCategoryForTemplate( template ) {
		var category;
		for ( category in taskTypeTemplateMapping ) {
			if ( taskTypeTemplateMapping[ category ].templates.join( '|' ) === template ) {
				return category;
			}
		}
		throw Error( 'No category :(' );
	}

	function getCategoryLabelForTemplate( template ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( template ) ].label;
	}

	function appendResultsToTaskOptions( searchResult, template ) {

		if ( list.findItemFromData( searchResult ) === null ) {
			resultCount += 1;
			list.addItems( [
				new TaskOptionWidget( {
					data: searchResult,
					template: template,
					label: searchResult.title
				} )
			] );
		}
	}

	function executeQuery( offset, template ) {
		apiQueryCount += 1;
		if ( offset !== 0 ) {
			queryParams.sroffset = offset;
		}
		$.get( 'https://' + lang + '.wikipedia.org/w/api.php?', queryParams )
			.then( function ( result ) {
				result.query.search.forEach( function ( searchResult ) {
					appendResultsToTaskOptions( searchResult, template );
				} );
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

	function doSearch() {
		var templateQuery,
			srqiprofile = searchProfileWidget.getMenu().findSelectedItem().getData();
		moreLike = [];
		hasTemplate = [];
		if ( moreLikeOverrideWidget.getData() ) {
			moreLike.push( [ moreLikeOverrideWidget.getData() ] );
		} else {
			topicWidget.getItems().forEach( function ( item ) {
				moreLike.push( item.data );
			} );
		}
		taskTypeWidget.getItems().forEach( function ( item ) {
			if ( item.selected ) {
				hasTemplate.push( item.data );
			}
		} );
		srSearch = '';
		info.toggle( false );
		list.clearItems();
		list.toggle( true );
		resultCount = 0;
		apiQueryCount = 0;
		$wrapper.find( '.result-count' ).toggle( true );
		$wrapper.find( '.query-count' ).toggle( true );
		if ( !hasTemplate.length ) {
			delete queryParams.srsearch;
			return;
		}
		hasTemplate.forEach( function ( templateGroup ) {
			templateQuery = templateGroup.join( '|' );
			srSearch = 'hastemplate:"' + templateQuery + '"';
			if ( moreLike.length ) {
				moreLike.forEach( function ( topicTitles ) {
					var perTopicQueryParams = queryParams,
						perTopicSrSearch = srSearch.trim() + ' morelikethis:"' + topicTitles.flat().join( '|' ) + '"';
					$.extend( perTopicQueryParams, {
						srsearch: perTopicSrSearch.trim(),
						srqiprofile: srqiprofile
					} );
					executeQuery( 0, templateQuery );
				} );
			} else {
				$.extend( queryParams, { srsearch: srSearch.trim() } );
				executeQuery( 0, templateQuery );
			}
		} );
	}

	function getIconForTemplate( templateName ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( templateName ) ].icon;
	}

	list.on( 'choose', function ( item ) {
		info.toggle( true );
		info.setLabel(
			new OO.ui.HtmlSnippet(
				'<strong><a href="https://' + lang + '.wikipedia.org/wiki/' + item.data.title + '">' + item.data.title + '</a></strong>' +
				'<br>' +
				item.data.snippet +
			'<br>' +
			'<p><strong>Template:</strong> ' + item.getTemplate() + ' ' +
			'<strong>Category:</strong> ' + getCategoryLabelForTemplate( item.getTemplate() ) + '</p>' )
		);
		info.setIcon( getIconForTemplate( item.getTemplate() ) );
		moreLikeOverrideWidget.setData( item.data.title );
		moreLikeOverrideWidget.toggle( true );
		moreLikeOverrideWidget.setLabel( 'Morelike search with ' + item.data.title );
	} );

	searchButton.on( 'click', function () {
		doSearch();
	} );

	moreLikeOverrideWidget.on( 'click', function () {
		doSearch();
	} );

	function doReset() {
		moreLike = [];
		hasTemplate = [];
		apiQueryCount = 0;
		resultCount = 0;
		taskTypeTemplateMapping = [];
		taskTypeWidget.clearItems();
		topicWidget.clearItems();
		topicWidget.getMenu().clearItems();
		topicWidget.setDisabled( true );
		searchButton.setDisabled( true );
		moreLikeOverrideWidget.toggle( false );
		list.clearItems();
		$wrapper.find( '.result-count' )
			.toggle( false )
			.text( '' );
		$wrapper.find( '.query-count' )
			.toggle( false )
			.text( '' );
	}

	resetButton.on( 'click', function () {
		doReset();
	} );

	function getTemplatesForLang( lang ) {
		taskTypeWidget.clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			titles: 'Growth/Personalized_first_day/Newcomer_tasks/Prototype/templates/' + lang + '.json',
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

	taskTypeWidget.on( 'select', function () {
		searchButton.setDisabled( true );
		taskTypeWidget.getItems().forEach( function ( item ) {
			if ( item.isSelected() ) {
				searchButton.setDisabled( false );
			}
		} );
	} );

	langSelectWidget.on( 'select', function ( item ) {
		if ( !item ) {
			return;
		}
		doReset();
		$( 'html' ).attr( 'lang', item.data );
		lang = item.data;
		hasTemplate = [];
		getTopicsForLang( lang );
		topicWidget.setDisabled( false );
		getTemplatesForLang( lang );
	} );

	$wrapper.append(
		controls.$element,
		info.$element,
		$resultCountHtml,
		$queryCountHtml,
		list.$element
	);
} );
