class CustomGrid {
    constructor() {
        this.config = {
            pageSize: 10,
            usePagination: true,
            useCaching: true,
            usePredictiveCaching: false,
            invalidateCacheOnDataWrite: false,
            columns: [],
            columnWidthMethod: "auto",
            actions: null,
            apiUrl: null,
            apiParams: null,
            apiRequestFormat: "query",
            apiRequestVerb: "GET",
            apiCaller: $.ajax,
            callbacks: {
                create: {
                    method: "none",
                    insertMethod: "top",
                    styles: "",
                    externalCallback: null
                },
                update: {
                    method: "none",
                    styles: "",
                    externalCallback: null
                },
                delete: {
                    method: "none",
                    styles: "",
                    externalCallback: null
                }
            },
            loadingControls: null,
            primaryKey: null,
            displayMode: "table",
            paginationMode: "replace",
            paginationMethod: "button",
            styles: {
                container: "", table: "", 
                thead: "", theadTr: "", theadTrTh: "",
                tbody: "", tbodyTr: "", tbodyTrTd: "",
                tfoot: "", tfootTr: "", tfootTrTd: ""
            },
            logLevel: "error"
        }

        this.logLevels = {
            error: true,
            warning: false,
            info: false,
            debug: false
        }

        this.loadingControls = {
            show: null,
            hide: null
        }

        this.columns = []
        this.pages = []
        this.dataWrites = 0

        return this
    }

    async init(element, api, config = null) {
        //  Check parameters
        if (element === null || element === undefined)
            return console.error("CustomGrid: Element is required.")
        if (api === null || api === undefined)
            return console.error("CustomGrid: API is required.")

        //  Initialize config
        if (config !== null) {
            //  Set quicker log levels
            if (config["logLevel"] !== undefined && config["logLevel"] !== null) {
                switch (config["logLevel"].toLowerCase()) {
                    case "error":
                        this.logLevels = {
                            error: true,
                            warning: false,
                            info: false,
                            debug: false
                        }
                        break;

                    case "warning":
                        this.logLevels = {
                            error: true,
                            warning: true,
                            info: false,
                            debug: false
                        }
                        break;

                    case "info":
                        this.logLevels = {
                            error: true,
                            warning: true,
                            info: true,
                            debug: false
                        }
                        break;

                    case "debug":
                        console.debug("CustomGrid.init(): Debug mode enabled. This should not be enabled in production environments.")
                        this.logLevels = {
                            error: true,
                            warning: true,
                            info: true,
                            debug: true
                        }
                        break;

                    default:
                        console.error("CustomGrid.init(): Invalid log level. Defaulting to error. Valid log levels are error, warning, info, and debug.")
                        break;
                }
            }

            //  Set config
            if (this.logLevels.debug)
                console.debug("CustomGrid.init(): Setting configuration.")
            
            config.styles = {
                ...this.config.styles,
                ...config.styles
            }

            this.config = {
                ...this.config,
                ...config
            }

            if (this.logLevels.debug)
                console.debug("CustomGrid.init(): Configuration set.", config)
        }

        //  Set quicker loading controls
        if (this.config.loadingControls !== null) {
            if (this.config.loadingControls.show !== null) {
                if (this.logLevels.debug)
                    console.debug("CustomGrid.init(): Setting loading show control.")
                this.loadingControls.show = this.config.loadingControls.show
            }
            if (this.config.loadingControls.hide !== null) {
                if (this.logLevels.debug)
                    console.debug("CustomGrid.init(): Setting loading hide control.")
                this.loadingControls.hide = this.config.loadingControls.hide
            }
        }

        //  Get data for page 0
        this.config.apiUrl = api
        await this.getData(0)
        if (this.pages[0].data === null)
            return console.error("CustomGrid.init(): Data for page 0 is null.")
        if (this.pages[0].data.count === 0)
            return console.error("CustomGrid.init(): Data count for page 0 is 0.")
        if (this.pages[0].data.result === null || this.pages[0].data.result === undefined)
            return console.error("CustomGrid.init(): Data result for page 0 is null.")
        if (this.pages[0].data.result.length === 0)
            return console.error("CustomGrid.init(): Data result for page 0 is empty.")

        //  Calculate columns
        if (this.logLevels.debug)
            console.debug("CustomGrid.init(): Calculating columns.")

        this.config.columns = Object.keys(this.pages[0].data.result[0])
            .map((x, i) => {
                var lowerX = x.toLowerCase()
                var configColumn = this.config.columns.find(y => y.key === x)
                return {
                    key: x,
                    primaryKey: this.config.primaryKey !== undefined && this.config.primaryKey === x,
                    header: configColumn !== undefined && configColumn.header !== undefined
                        ? configColumn.header
                        : x.match(/[A-Z][a-z]+/g).join(' '),
                    hidden: configColumn !== undefined && configColumn.hidden !== undefined
                        ? configColumn.hidden
                        : lowerX !== "id" && lowerX.endsWith("id"),
                    windth: configColumn !== undefined && configColumn.width !== undefined
                        ? configColumn.width
                        : null,
                    index: configColumn !== undefined && configColumn.index !== undefined
                        ? configColumn.index
                        : i,
                    onClick: configColumn !== undefined && configColumn.onClick !== undefined
                        ? configColumn.onClick
                        : null
                }
            }).sort((a, b) => a.index - b.index)

        if (this.config.actions !== null) {
            if (this.logLevels.debug)
                console.debug("CustomGrid.init(): Adding actions to columns.")

            var configColumn = this.config.columns.find(y => y.key === "actions")
            this.config.columns.push({
                key: "actions",
                primaryKey: false,
                header: configColumn !== undefined && configColumn.header !== undefined
                    ? configColumn.header
                    : "Actions",
                hidden: false
            })
        }

        if (this.logLevels.debug)
            console.debug("CustomGrid.init(): Columns calculated.", this.config.columns)

        //  Render grid && pageTo
        this.config.domElement = "#" + element
        this.name = element
        this.renderGrid()
        this.pageTo(0)
    }

    //#region Data Actions
    async refresh() {
        this.pages = []
        this.dataWrites = 0
        this.pageTo(this.currentPageIndex)
    }

    async pageTo(index) {
        //  get data
        var page = this.pages.find(x => x.index === index)
        if (page === undefined) {
            await this.getData(index)
            page = this.pages.find(x => x.index === index)
        }

        if (page === undefined) 
            return console.error("CustomGrid.pageTo(): Page data not found.")

        //  render data
        this.currentPageIndex = index
        this.renderPages([page])
        this.renderPaginationButtons()

        if (this.config.useCaching) {
            if (this.logLevels.debug)
                console.debug("CustomGrid.pageTo(): Removing pages not on pagination.")

            this.pages = this.pages.filter(
                x => x.index === 0
                    || x.index === this.totalPages - 1
                    || (
                        x.index >= index - 1
                        && x.index <= index + 1
                    )
            )

            if (this.config.usePredictiveCaching) {
                if (this.logLevels.debug)
                    console.debug("CustomGrid.pageTo(): Fetching predictive pages.")
    
                // start
                if (this.pages.find(x => x.index === 0) === undefined)
                    await this.getData(0, false)
    
                // end
                if (this.pages.find(x => x.index === this.totalPages - 1) === undefined)
                    await this.getData(this.totalPages - 1, false)
                
                // index - 1
                if (x.index > 0 && this.pages.find(x => x.index === index - 1) === undefined)
                    await this.getData(index - 1, false)
    
                // index + 1
                if (x.index + 1 < this.totalPages && this.pages.find(x => x.index === index + 1) === undefined)
                    await this.getData(index + 1, false)
            }
        } else {
            this.pages = [page]
        }
    }

    async getData(index, showLoading = true) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.getData(): Getting data for page", index)

        if (this.loadingControls.show !== null && !showLoading)
            this.loadingControls.show(`Loading Page ${index}...`)

        await this.config.apiCaller({
            url: this.config.apiUrl,
            type: "GET",
            data: {
                ...this.config.apiParams,
                usePagination: this.config.usePagination,
                page: index + 1,
                pageSize: this.config.pageSize
            }
        }).then((res) => {
            if (this.logLevels.debug)
                console.debug("CustomGrid.getData(): Data retrieved.", res)

            if (this.config.useCaching === true) {
                this.pages.push({
                    index: index,
                    data: res
                })
            } else {
                this.pages = [{
                    index: index,
                    data: res
                }]
            }
        }).catch((error) => {
            console.error("CustomGrid.getData(): Error retrieving data.", error)
        }).always(_ => {
            if (this.loadingControls.hide !== null)
                this.loadingControls.hide()
        })
    }

    getRecord(primaryKey) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.getRecord(): Getting record with primary key", primaryKey)

        var page = this.pages.find(x => x.data.result.find(y => y[this.config.primaryKey] === primaryKey))
        if (page === undefined) {
            console.error("CustomGrid.getRecord(): Record not found.")
            return null
        }

        return page.data.result.find(x => x[this.config.primaryKey] === primaryKey)
    }

    updateColumnWhere(filterKey, filterValue, updateKey, updateValue, reRender = false) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.updateColumnWhere(): Updating column where", filterKey, "is", filterValue, "to", updateKey, "is", updateValue)

        this.pages.forEach(x => {
            x.data.result.forEach(y => {
                if (y[filterKey] === filterValue)
                    y[updateKey] = updateValue
            })
        })

        if (reRender)
            this.pageTo(this.currentPageIndex)
    }
    //#endregion

    //#region Render Actions
    renderGrid() {
        if (this.logLevels.debug)
            console.debug("CustomGrid.renderGrid(): Rendering grid.")

        var widthPerColumn = 100.0 / this.config.columns.filter(x => !x.hidden).length
        var gridHtml = `<div class='${this.config.styles.container}'>
            <table class='${this.config.styles.table}'>
                <thead class='${this.config.styles.thead}'>
                    <tr class='${this.config.styles.theadTr}'>`
        gridHtml += this.config.columns
            .filter(x => !x.hidden)
            .map(x => {
                var colWidth = ""
                if (this.config.columnWidthMethod === "even" && x.key !== "actions")
                    colWidth = `style="width: ${widthPerColumn}% !important;"`
                else if (this.config.columnWidthMethod === "evenConfigOverride")
                    colWidth = x.width !== null && x.width !== undefined
                        ? `style="width: ${x.width} !important;"`
                        : `style="width: ${widthPerColumn}% !important;"`

                if (x.key === "actions" && this.config.actions !== null)
                    return `<th class='${this.config.styles.theadTrTh} ${this.config.styles.actions}' ${colWidth}>${x.header}</th>`
                return `<th class='${this.config.styles.theadTrTh}' ${colWidth}>${x.header}</th>`
            })
            .join('')

        gridHtml += `</tr></thead><tbody id="${this.name}_tableBody"
            class='${this.config.styles.tbody}'></tbody></table>`

        if (this.config.usePagination === true) {
            gridHtml += `<div class='${this.config.styles.tfoot}'>
                <div class='${this.config.styles.tfootTr}'>
                    <div id='${this.name}_paginationBtns' class='${this.config.styles.tfootTrTd}'></div>
                    <div id='${this.name}_paginationInfo' class='${this.config.styles.tfootTrTd}'></div>
                </div>
            </div>`
        }

        gridHtml += `</div>`

        $(this.config.domElement).html(gridHtml)
    }

    renderPages(pages = null) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.renderPages(): Rendering pages.")

        var primaryKey = this.config.primaryKey
        var data = pages.map(x => x.data.result).flat()
        $(`#${this.name}_tableBody`).html(
            data.map(x => {
                var key = x[primaryKey]
                var keyHtml = key !== undefined && key !== null
                    ? `entity-id='${key}'`
                    : ""
                return `<tr class='${this.config.styles.tbodyTr}' ${keyHtml}>${
                    this.config.columns
                        .filter(y => !y.hidden)
                        .map(y => {
                            if (y.key === "actions" && this.config.actions !== null) {
                                return `<td class='${this.config.styles.actions}'>${this.config.actions.map(z => {
                                    return `<button class='${this.config.styles.actionsBtn} ${z.styles}' onclick="${z.onClick}('${key}')" title="${z.type}">
                                        <span class='${z.icon}'></span>
                                    </button>`
                                }).join('')}</td>`
                            }
                            return `<td class='${this.config.styles.tbodyTrTd} ${y.onClick ? 'cursor-pointer hover-underline' : ''}'
                                ${y.onClick ? `onclick="${y.onClick}('${key}')"` : ''}>
                                ${x[y.key] || ""}
                            </td>`
                        })
                        .join('')
                }</tr>`
            })
            .join('')
        )
    }

    renderRow(entity, additionalRowStyles = "") {
        if (this.logLevels.debug)
            console.debug("CustomGrid.renderRow(): Rendering row for entity.", entity)

        var key = entity[this.config.primaryKey]
        var keyHtml = key !== undefined && key !== null
            ? `entity-id='${key}'`
            : ""

        return `<tr class='${this.config.styles.tbodyTr + " " + additionalRowStyles}' ${keyHtml}>${
            this.config.columns
                .filter(y => !y.hidden)
                .map(y => {
                    if (y.key === "actions" && this.config.actions !== null) {
                        return `<td class='${this.config.styles.actions}'>${this.config.actions.map(z => {
                            return `<button class='${this.config.styles.actionsBtn} ${z.styles}' onclick="${z.onClick}('${key}')" title="${z.type}">
                                <span class='${z.icon}'></span>
                            </button>`
                        }).join('')}</td>`
                    }
                    return `<td class='${this.config.styles.tbodyTrTd} ${y.onClick ? 'cursor-pointer hover-underline' : ''}'
                        ${y.onClick ? `onclick="${y.onClick}('${key}')"` : ''}>
                        ${entity[y.key] || ""}
                    </td>`
                })
                .join('')
        }</tr>`
    }

    renderPaginationButtons() {
        if (this.config.usePagination === false)
            return
        if (this.logLevels.debug)
            console.debug("CustomGrid.renderPaginationButtons(): Rendering pagination buttons.")
        
        var paginationHtml = ""
        var paginationInfoHtml = ""

        this.totalPages = Math.ceil(this.pages[0].data.count / this.config.pageSize)

        if (this.currentPageIndex === 0) {
            paginationHtml += `
                <button class='rounded-start ${this.config.styles.paginationBtn} ${this.config.styles.paginationBtnInactive}' disabled>
                    <<
                </button>
                <button class='${this.config.styles.paginationBtn} ${this.config.styles.paginationBtnActive}'>1</button>`
        } else {
            paginationHtml += `
                <button class='rounded-start ${this.config.styles.paginationBtn}' onclick='${this.name}.pageTo(0)'>
                    <<
                </button>
                <button class='${this.config.styles.paginationBtn}' onclick='${this.name}.pageTo(${this.currentPageIndex - 1})'>
                    ${this.currentPageIndex}
                </button>
                <button class='${this.config.styles.paginationBtn} ${this.config.styles.paginationBtnActive}'>
                    ${this.currentPageIndex + 1}
                </button>`
        }

        if (this.totalPages > this.currentPageIndex + 1) {
            paginationHtml += `
                <button class='${this.config.styles.paginationBtn}' onclick='${this.name}.pageTo(${this.currentPageIndex + 1})'>
                    ${this.currentPageIndex + 2}
                </button>
                <button class='rounded-end ${this.config.styles.paginationBtn}' onclick='${this.name}.pageTo(${this.totalPages - 1})'>
                    >>
                </button>`
        } else {
            paginationHtml += `
                <button class='rounded-end ${this.config.styles.paginationBtn} ${this.config.styles.paginationBtnInactive}' disabled>
                    >>
                </button>`
        }

        paginationInfoHtml += `Page ${this.currentPageIndex + 1} of ${this.totalPages} (${this.pages[0].data.count} items)`

        $(`#${this.name}_paginationBtns`).html(paginationHtml)
        $(`#${this.name}_paginationInfo`).html(paginationInfoHtml)
    }
    //#endregion

    //#region Callbacks
    createCallback(entity) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.createCallback(): Creating entity.", entity)

        this.dataWrites++
        if (this.config.invalidateCacheOnDataWrite === true)
            this.pages = [this.pages[this.currentPageIndex]]

        if (this.config.callbacks.create.method === "none")
            return

        if (this.config.callbacks.create.method.includes("insert")) {
            var row = this.renderRow(entity, this.config.callbacks.create.styles)
            if (this.config.callbacks.create.insertMethod === "top") {
                $(`#${this.name}_tableBody`).prepend(row)
                this.pages[this.currentPageIndex].data.result.unshift(entity)
            } else {
                $(`#${this.name}_tableBody`).append(row)
                this.pages[this.currentPageIndex].data.result.push(entity)
            }
        }

        if (this.config.callbacks.create.externalCallback !== null)
            this.config.callbacks.create.externalCallback(entity)
    }

    updateCallback(entity) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.updateCallback(): Updating entity.", entity)

        if (this.config.callbacks.update.method === "none")
            return

        if (this.config.callbacks.update.method.includes("replace")) {
            if (this.pages[this.currentPageIndex].data.result.find(x => x[this.config.primaryKey] === entity[this.config.primaryKey]) !== undefined) {
                //  check if row is in current index
                var row = this.renderRow(entity, this.config.callbacks.update.styles)
                $(`#${this.name}_tableBody tr[entity-id='${entity[this.config.primaryKey]}']`).replaceWith(row)

                var indexInCurrentPage = this.pages[this.currentPageIndex].data.result.findIndex(
                    x => x[this.config.primaryKey] === entity[this.config.primaryKey]
                )
                if (indexInCurrentPage !== -1)
                    this.pages[this.currentPageIndex].data.result[indexInCurrentPage] = entity
            } else {
                //  check if row is in other indexes
                var pageIndex = this.pages.findIndex(x => x.data.result.find(y => y[this.config.primaryKey] === entity[this.config.primaryKey]))
                if (pageIndex !== -1) {
                    var indexInPage = this.pages[pageIndex].data.result.findIndex(
                        x => x[this.config.primaryKey] === entity[this.config.primaryKey]
                    )
                    if (indexInPage !== -1)
                        this.pages[pageIndex].data.result[indexInPage] = entity
                }
            }
        }

        if (this.config.callbacks.update.externalCallback !== null)
            this.config.callbacks.update.externalCallback(entity)
    }

    deleteCallback(entity) {
        if (this.logLevels.debug)
            console.debug("CustomGrid.deleteCallback(): Deleting entity.", entity)

        this.dataWrites++
        if (this.config.invalidateCacheOnDataWrite === true)
            this.pages = [this.pages[this.currentPageIndex]]
    
        if (this.config.callbacks.delete.method === "none")
            return

        if (this.config.callbacks.delete.method.includes("remove")) {
            var row = $(`#${this.name}_tableBody tr[entity-id='${entity[this.config.primaryKey]}']`)
            if (row.length > 0) {
                row.remove()
                var indexInCurrentPage = this.pages[this.currentPageIndex].data.result.findIndex(
                    x => x[this.config.primaryKey] === entity[this.config.primaryKey]
                )
                if (indexInCurrentPage !== -1)
                    this.pages[this.currentPageIndex].data.result.splice(indexInCurrentPage, 1)
            }
        }

        if (this.config.callbacks.delete.externalCallback !== null)
            this.config.callbacks.delete.externalCallback(entity)
    }
    //#endregion
}