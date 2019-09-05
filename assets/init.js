$( function () {
	var taskTypeTemplateMapping = {
			copyedit: {
				label: 'Copy editing',
				icon: 'articleCheck',
				templates: [
					'Upravit',
					'Kdy\?',
					'Kdo\?',
					'Pravopis',
					'Sloh',
					'Transkripce',
					'Reklama',
					'NPOV',
					'Kým\?',
					'Jaký\?',
					'Který\?'
				]
			},
			references: {
				label: 'References',
				icon: 'references',
				templates: [
					'Doplňte zdroj',
					'Neověřeno'
				]
			},
			info: {
				label: 'Info',
				icon: 'infoFilled',
				templates: [
					'Nejisté datum'
				]
			},
			update: {
				label: 'Update',
				icon: 'edit',
				templates:
					[
						'Aktualizovat',
						'Aktualizovat po'
					]
			},
			links: {
				label: 'Links',
				icon: 'link',
				templates: [
					'Wikifikovat'
				]
			}
		},
		topicWidget,
		resultCount = 0,
		info = new OO.ui.MessageWidget( {
			type: 'notice',
			label: 'Task detail',
			classes: [ 'task-info' ]
		} ).toggle( false ),
		$wrapper = $( '.wrapper' ),
		$resultCountHtml = $( '<p>' )
			.addClass( 'result-count' ),
		topicsToArticles = {
			// TODO: These articles are chosen semi-randomly from the list of vital articles.
			//  We would want to randomly select them, and not hardcode.
			arts: [
				'Umění',
				'Moderna',
				'Literatura',
				'Hudba',
				'Výtvarné_umění',
				'Múzická_umění',
				'Architektura'
			],
			philosophy: [
				'Filosofie',
				'Poznatek',
				'Etika',
				'Logika',
				'Východní_filosofie',
				'Estetika',
				'Gnozeologie'
			]
		},
		taskTypeWidget = new OO.ui.CheckboxMultiselectWidget( {
			classes: [ 'task-type' ],
			items: Array.from( Object.keys( taskTypeTemplateMapping ), function ( item ) {
				var dataItem = taskTypeTemplateMapping[ item ];
				return new OO.ui.CheckboxMultioptionWidget( {
					data: dataItem.templates,
					label: dataItem.label
				} );
			} )
		} ),
		hasTemplate = [],
		moreLike = [],
		srSearch = '',
		list = new OO.ui.SelectWidget( {
			classes: [ 'newcomer-tasks' ]
		} ),
		baseUrl = 'https://cs.wikipedia.org',
		queryParams = {
			action: 'query',
			format: 'json',
			list: 'search',
			srlimit: 10,
			srnamespace: 0,
			origin: '*'
		},
		TaskOptionWidget = function ( config ) {
			config = config || {};
			TaskOptionWidget.parent.call( this, config );
			this.template = config.template;
			this.category = config.category;
		},
		TopicSelectionWidget = function ( config ) {
			config = config || {};
			TopicSelectionWidget.parent.call( this, config );
		};

	OO.inheritClass( TaskOptionWidget, OO.ui.OptionWidget );
	OO.inheritClass( TopicSelectionWidget, OO.ui.MenuTagMultiselectWidget );

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

	topicWidget = new TopicSelectionWidget( {
		allowArbitrary: false,
		options: [
			{
				data: topicsToArticles.arts,
				label: 'Arts'
			},
			{
				data: topicsToArticles.philosophy,
				label: 'Philosophy'
			}
		]
	} );

	function updateQueryParams() {
		srSearch = '';
		info.toggle( false );
		if ( hasTemplate.length ) {
			if ( moreLike.length ) {
				srSearch = 'morelikethis:' + moreLike.flat().join( '|' );
			}

		} else {
			delete queryParams.srsearch;
		}
		if ( hasTemplate.length ) {
			list.clearItems();
			list.toggle( true );
			resultCount = 0;
			$wrapper.find( '.result-count' ).toggle( true );
			$wrapper.find( '.query-debug' ).text( '' );
			hasTemplate.flat().forEach( function ( template ) {
				var perTemplateQuery = queryParams,
					perTemplateSrSearch = srSearch.trim() + ' hastemplate:' + template;
				$.extend( perTemplateQuery, { srsearch: perTemplateSrSearch.trim() } );
				$wrapper.find( '.query-debug' )
					.append( '<br />' )
					.append( JSON.stringify( perTemplateQuery, null, 2 ) );
				$.get( baseUrl + '/w/api.php?', queryParams )
					.then( function ( result ) {
						result.query.search.forEach( function ( searchResult ) {
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
						} );
						$wrapper.find( '.result-count' )
							.text( resultCount + ' results found' );
					}, function ( err ) {
						console.log( err );
					} );
			} );

		}
	}

	function getIconForTemplate( templateName ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( templateName ) ].icon;
	}

	list.on( 'choose', function ( item ) {
		info.toggle( true );
		info.setLabel(
			new OO.ui.HtmlSnippet(
				'<strong><a href="' + baseUrl + '/wiki/' + item.data.title + '">' + item.data.title + '</a></strong>' +
				'<br>' +
				item.data.snippet +
			'<br>' +
			'<p><strong>Template:</strong> ' + item.getTemplate() + ' ' +
			'<strong>Category:</strong> ' + getCategoryLabelForTemplate( item.getTemplate() ) + '</p>' )
		);
		info.setIcon( getIconForTemplate( item.getTemplate() ) );
	} );

	topicWidget.on( 'change', function () {
		moreLike = [];
		topicWidget.getItems().forEach( function ( item ) {
			moreLike.push( item.data );
		} );
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
		}
	} );

	$wrapper.append(
		topicWidget.$element,
		taskTypeWidget.$element,
		info.$element,
		$resultCountHtml,
		list.$element
	);
} );
