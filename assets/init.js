$( function () {
	var taskTypeTemplateMapping = {},
		lang = $( 'html' ).attr( 'lang' ),
		topicsSource = new OO.ui.TextInputWidget( {
			value: '',
			title: 'See User:KHarlan_(WMF)/newcomertasks/topics/cs.json for example.',
			placeholder: 'User:KHarlan_(WMF)/newcomertasks/topics/'
		} ),
		templateSource = new OO.ui.TextInputWidget( {
			value: '',
			title: 'Source page with templates. See User:KHarlan_(WMF)/newcomertasks/templates/cs.json for example.',
			placeholder: 'User:KHarlan_(WMF)/newcomertasks/templates/'
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
		titleInputWidget = new OO.ui.TextInputWidget( {
			placeholder: 'Pipe-delimited titles for debugging morelikethis. Example: "Inženýrství|Strojírenství" for "Engineering".'
		} ).toggle ( false ),
		resultCount = 0,
		info = new OO.ui.MessageWidget( {
			type: 'notice',
			label: 'Task detail',
			classes: [ 'task-info' ]
		} ).toggle( false ),
		$wrapper = $( '.wrapper' ),
		$resultCountHtml = $( '<p>' )
			.addClass( 'result-count' ),
		taskTypeWidget = new OO.ui.CheckboxMultiselectWidget( {
			classes: [ 'task-type' ],
			items: [],

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
			srlimit: 30,
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

	topicWidget = new TopicSelectionWidget( {
		allowArbitrary: false,
		options: []
	} );

	function getTopicsForLang( lang ) {
		topicWidget.getMenu().clearItems();
		$.get( 'https://www.mediawiki.org/w/api.php', {
			action: 'query',
			prop: 'revisions',
			titles: 'User:KHarlan_(WMF)/newcomertasks/topics/' + lang + '.json',
			rvprop: 'content',
			format: 'json',
			formatversion: 2,
			rvslots: '*',
			origin: '*'
		}, function ( response ) {
			var topics = JSON.parse( response.query.pages[0].revisions[0].slots.main.content),
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
			if ( taskTypeTemplateMapping[ category ].templates.indexOf( template ) !== -1 ) {
				return category;
			}
		}
	}

	function getCategoryLabelForTemplate( template ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( template ) ].label;
	}

	function updateQueryParams() {
		srSearch = '';
		info.toggle( false );
		list.clearItems();
		list.toggle( true );
		resultCount = 0;
		$wrapper.find( '.result-count' ).toggle( true );
		$wrapper.find( '.query-debug' ).text( '' );
		if ( !hasTemplate.length ) {
			delete queryParams.srsearch;
			return;
		}
		if ( moreLike.length ) {
			srSearch = 'morelikethis:"' + moreLike.flat().join( '|' ) + '"';
		}
		// Override topic selection if we're debugging.
		if ( titleInputWidget.getValue() ) {
			srSearch = 'morelikethis:"' + titleInputWidget.getValue() + '"';
		}
		hasTemplate.flat().forEach( function ( template ) {
			var perTemplateQuery = queryParams,
				perTemplateSrSearch = srSearch.trim() + ' hastemplate:"' + template + '"';
			$.extend( perTemplateQuery, { srsearch: perTemplateSrSearch.trim() } );
			$wrapper.find( '.query-debug' )
				.append( '<br />' )
				.append( JSON.stringify( perTemplateQuery, null, 2 ) );
			$.get( 'https://' + lang + '.wikipedia.org/w/api.php?', queryParams )
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

	function getIconForTemplate( templateName ) {
		return taskTypeTemplateMapping[ getCategoryForTemplate( templateName ) ].icon;
	}

	list.on( 'choose', function ( item ) {
		info.toggle( true );
		info.setLabel(
			new OO.ui.HtmlSnippet(
				'<strong><a href="' + 'https://' + lang + '.wikipedia.org/wiki/' + item.data.title + '">' + item.data.title + '</a></strong>' +
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
			    response.query.pages[0].revisions[0].slots.main.content
			    ),
			    key;

	    	for ( key in templates ) {
			    taskTypeWidget.addItems( [ new OO.ui.CheckboxMultioptionWidget( {
				    data: templates[key].templates,
				    label: templates[key].label
			    })])
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
		}
	} );

	$wrapper.append(
		new OO.ui.FieldLayout( topicsSource, {
			align: 'left',
			label: 'Source page for topics',
			value: 'User:KHarlan_(WMF)/newcomertasks/topics/',
			help: 'See https://www.mediawiki.org/wiki/User:KHarlan_(WMF)/newcomertasks/topics/cs.json for example.'
		} ).$element,
		new OO.ui.FieldLayout( templateSource, {
			align: 'left',
			label: 'Source page for templates',
			value: 'User:KHarlan_(WMF)/newcomertasks/templates/',
			help: 'See https://www.mediawiki.org/wiki/User:KHarlan_(WMF)/newcomertasks/templates/cs.json for example.'
		} ).$element,
		langSelectWidget.$element,
		topicWidget.$element,
		taskTypeWidget.$element,
		info.$element,
		$resultCountHtml,
		list.$element
	);
} );
