$( function () {
	var taskTypeTemplateMapping = {},
		lang = $( 'html' ).attr( 'lang' ),
		queryLimit = 25,
		apiQueryCount = 0,
		freeTextSearchWidget = new OO.ui.SearchInputWidget( {
			placeholder: 'Free text search (ignores topic selection)',
			disabled: true
		} ),
		instructionsWidget = new OO.ui.PopupButtonWidget( {
			icon: 'help',
			framed: false,
			label: null,
			popup: {
				head: true,
				label: null,
				$content: $( '<p><ul>' +
					'<li>Templates and topics are loaded from mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/templates/{langCode}.json and mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/topics/{langCode}.json</li>' +
					'<li>A morelikethis search is executed using pipe delimited Topic titles. So if your "Sport" topic has "Football" and "Basketball", you\'ll see morelikethis:Football|Basketball. This is a logical AND search, because morelike is using all the words from these two articles as the seed for a search.</li>' +
					'<li>However, if multiple topics are selected, those are all logical OR searches.</li>' +
					'<li>You can adjust the "qiprofile" used with the search. More detail on that in the help icon next to the dropdown.</li>' +
					'<li>After making a search and clicking on an entry, a new button appears that lets you test out a morelike search using the existing task type selection and morelikethis:{currentArticle}</li>' +
					'<li>The app will pull down all available results. So if you don\'t select a topic with Czech and click on "Kopírovat úpravy" you\'ll end up with thousands of results. If your browser starts to hang, reload the window and start over ¯\\_(ツ)_/¯</li>' +
					'<li>After selecting a task type, you can use the free text field to experiment with free text searches. Any topic selections will be ignored. The search will be a regular keyword search, not morelike.</li>' +
					'<li>To see the actual search queries being performed, right click in the browser, select "Inspect element", then click on the Network tab and look at the API requests being made.</li>' +
					'</ul></p>' ),
				padded: true,
				align: 'bottom'
			}
		} ),
		searchProfileHelp = new OO.ui.PopupButtonWidget( {
			icon: 'info',
			framed: false,
			label: null,
			invisibleLabel: true,
			popup: {
				head: true,
				label: null,
				$content: $( '<p>See srqiprofile <a href="https://www.mediawiki.org/wiki/API:Search">here</a></p>' ),
				padded: true,
				align: 'forwards'
			}
		} ),
		searchProfileWidget = new OO.ui.DropdownWidget( {
			label: 'srqiprofile (classic_noboostlinks)',
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
			label: null,
			invisibleLabel: true,
			popup: {
				head: true,
				label: null,
				$content: $(
					'<p>Topics are editable at <em>https://www.mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/topics/{langCode}.json</em></p>' +
					'<p>Templates (task types) are editable at <em>https://www.mediawiki.org/wiki/Growth/Personalized_first_day/Newcomer_tasks/Prototype/templates/{langCode}.json</em></p>'
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
						instructionsWidget
					]
				} )
			),
			new OO.ui.FieldLayout(
				new OO.ui.Widget( {
					content: [
						new OO.ui.HorizontalLayout( {
							items: [
								helpWidget, langSelectWidget, topicWidget, taskTypeWidget
							]
						} ),
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
						freeTextSearchWidget
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
			freeTextOverride = freeTextSearchWidget.getValue(),
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
			if ( moreLike.length && !freeTextOverride ) {
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
				if ( freeTextOverride ) {
					srSearch += ' ' + freeTextOverride;
				}
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
		moreLikeOverrideWidget.setData( '' );
		moreLikeOverrideWidget.toggle( false );
		doSearch();
	} );

	moreLikeOverrideWidget.on( 'click', function () {
		list.clearItems();
		$wrapper.find( '.result-count' )
			.toggle( false )
			.text( '' );
		$wrapper.find( '.query-count' )
			.toggle( false )
			.text( '' );
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
		freeTextSearchWidget.setValue( null );
		freeTextSearchWidget.setDisabled( true );
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
				freeTextSearchWidget.setDisabled( false );
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
