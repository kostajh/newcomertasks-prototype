$( function () {
	var taskTypeTemplateMapping = {},
		lang = $( 'html' ).attr( 'lang' ),
		maxResultsinUi = 10000,
		topLevelCategories = [],
		maxDepth = 1,
		baseConfigSource = 'User:KHarlan_(WMF)',
		categoryToTopicMapping = {},
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
		moreLike = [],
		srSearch = '',
		list = new OO.ui.SelectWidget( {
			classes: [ 'newcomer-tasks' ]
		} ),
		queryParams = {
			action: 'query',
			format: 'json',
			list: 'search',
			srlimit: 'max',
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
		TopicSelectionWidget = function ( config ) {
			config = config || {};
			TopicSelectionWidget.parent.call( this, config );
		};

	OO.inheritClass( TaskOptionWidget, OO.ui.OptionWidget );
	OO.inheritClass( TopicSelectionWidget, OO.ui.MenuTagMultiselectWidget );

	TaskOptionWidget.prototype.getTemplate = function () {
		return this.template;
	};

	TaskOptionWidget.prototype.getCategory = function () {
		return this.category;
	};

	topicWidget = new TopicSelectionWidget( {
		allowArbitrary: false,
		options: []
	} );

	function getTopicsForLang( lang ) {
		topicWidget.getMenu().clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			action: 'query',
			prop: 'revisions',
			titles: baseConfigSource + '/newcomertasks/topics/' + lang + '.json',
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
					topicWidget.createMenuOptionWidget( topics[ key ].category, topics[ key ].label, '' )
				] );
				categoryToTopicMapping[ topics[ key ].category ] = topics[ key ].label;
			}
		} );
	}

	function getSubcategories( category ) {
		var subcats = [];
		return $.get( 'https://' + lang + '.wikipedia.org/w/api.php?', {
			action: 'query',
			format: 'json',
			formatversion: 2,
			prop: 'categoryinfo',
			generator: 'categorymembers',
			gcmtitle: 'Kategorie:' + category,
			gcmprop: 'ids|title',
			gcmlimit: 'max',
			gcmtype: 'subcat',
			origin: '*'
		} ).then( function ( result ) {
			var topic = categoryToTopicMapping[ category ];
			result.query.pages.forEach( function ( subcat ) {
				subcats.push( subcat.title.replace( 'Kategorie:', '' ) );
				categoryToTopicMapping[ subcat.title.replace( 'Kategorie:', '' ) ] = topic;
			} );
			return subcats;
		}, function ( error ) {
			console.log( 'error', error );
		} );
	}

	function appendResultsToTaskOptions( searchResult, template, category ) {
		if ( list.findItemFromData( searchResult ) === null ) {
			resultCount += 1;
			if ( resultCount < maxResultsinUi ) {
				list.addItems( [
					new TaskOptionWidget( {
						data: searchResult,
						template: template,
						category: category,
						label: searchResult.title
					} )
				] );
			}
		}
	}

	function doDeepcatAndHasTemplateSearch( category, template, offset, depth ) {
		var perTemplateQuery = queryParams,
			deepcatSearch = 'deepcat:"' + category + '"',
			hasTemplate = 'hastemplate:"' + template + '"',
			perTemplateSrSearch = srSearch.trim() + ' ' + hasTemplate,
			inCategorySearch = 'incategory:"' + category + '"',
			perTemplateInCategorySearch = inCategorySearch.trim() + ' ' + hasTemplate;
		apiQueryCount += 1;
		$wrapper.find( '.query-count' )
			.text( apiQueryCount + ' API queries executed' );
		$.extend( perTemplateQuery, { srsearch: perTemplateSrSearch.trim() } );
		$wrapper.find( '.query-debug' )
			.append( '<br />' )
			.append( JSON.stringify( perTemplateQuery, null, 2 ) );
		if ( offset !== 0 ) {
			queryParams.sroffset = offset;
		}

		$.get( 'https://' + lang + '.wikipedia.org/w/api.php?', $.extend( queryParams, {
			srsearch: perTemplateInCategorySearch.trim()
		} ) ).then( function ( result ) {
			result.query.search.forEach( function ( searchResult ) {
				appendResultsToTaskOptions( searchResult, template, category );
			} );
		} ).then( function () {
			if ( depth > maxDepth ) {
				console.log( 'dont look too deep' );
				return;
			}
			$.get( 'https://' + lang + '.wikipedia.org/w/api.php?', $.extend( queryParams, {
				srsearch: deepcatSearch + ' ' + hasTemplate
			} ) ).then( function ( result ) {
				if ( result.warnings && result.warnings.search && depth < maxDepth ) {
					getSubcategories( category ).then( function ( subcats ) {
						subcats.forEach( function ( subcat ) {
							doDeepcatAndHasTemplateSearch( subcat, template, 0, depth + 1 );
						} );
					} );
				}
				if ( result.continue && result.continue.sroffset && depth < maxDepth ) {
					doDeepcatAndHasTemplateSearch(
						category,
						template,
						result.continue.sroffset,
						depth + 1
					);
				}

				result.query.search.forEach( function ( searchResult ) {
					resultCount += 1;
					$wrapper.find( '.result-count' )
						.text( resultCount + ' results found' );

					appendResultsToTaskOptions( searchResult, template, category );
				} );
			}, function ( error ) {
				console.log( 'error', error );
			} );
		} );
	}

	function getCategoryForTemplate( template ) {
		var category;
		for ( category in taskTypeTemplateMapping ) {
			if ( taskTypeTemplateMapping[ category ].templates.indexOf( template ) !== -1 ) {
				return category;
			}
		}
	}

	function getTaskTypeFromTemplate( template ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( template ) ].label;
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

	function updateQueryParams() {
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
		if ( topLevelCategories.length ) {
			topLevelCategories.forEach( function ( topLevelCategory ) {
				hasTemplate.flat().forEach( function ( template ) {
					doDeepcatAndHasTemplateSearch( topLevelCategory, template, 0, 0 );
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
				'<strong><a href="https://' + lang + '.wikipedia.org/wiki/' + item.data.title + '">' + item.data.title + '</a></strong>' +
				'<br>' +
				item.data.snippet +
			'<br>' +
			'<p><strong>Template:</strong> ' + item.getTemplate() + ' ' +
			'<strong>Category:</strong> ' + item.getCategory() + ' ' +
			'<strong>Task type:</strong> ' + getTaskTypeFromTemplate( item.getTemplate() ) + '</p>' )
		);
		info.setIcon( getIconForTemplate( item.getTemplate() ) );
	} );

	topicWidget.on( 'change', function () {
		topicWidget.getItems().forEach( function ( item ) {
			topLevelCategories.push( item.data );
		} );
		updateQueryParams();
	} );

	function getTemplatesForLang( lang ) {
		taskTypeWidget.clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			titles: baseConfigSource + '/newcomertasks/templates/' + lang + '.json',
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
		getTopicsForLang( lang );
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
		topicWidget.$element,
		taskTypeWidget.$element,
		info.$element,
		$resultCountHtml,
		$queryCountHtml,
		list.$element
	);
} );
