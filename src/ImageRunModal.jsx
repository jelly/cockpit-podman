import React from 'react';
import PropTypes from 'prop-types';
import {
    Button, Checkbox, Form, FormGroup, FormSelect, FormSelectOption,
    HelperText, HelperTextItem,
    InputGroup, Modal, TextInput, SelectVariant, Select, SelectGroup, SelectOption, Spinner,
    Tabs, Tab, TabTitleText, ToggleGroup, ToggleGroupItem, Flex, FlexItem, Popover
} from '@patternfly/react-core';
import { CloseIcon, PlusIcon, SearchIcon, OutlinedQuestionCircleIcon } from '@patternfly/react-icons';
import * as dockerNames from 'docker-names';

import { ErrorNotification } from './Notification.jsx';
import { FileAutoComplete } from 'cockpit-components-file-autocomplete.jsx';
import * as utils from './util.js';
import * as client from './client.js';
import rest from './rest.js';
import cockpit from 'cockpit';

import "./ImageRunModal.scss";

const _ = cockpit.gettext;

const systemOwner = "system";

const units = {
    KiB: {
        name: "KiB",
        base1024Exponent: 1,
    },
    MiB: {
        name: "MiB",
        base1024Exponent: 2,
    },
    GiB: {
        name: "GiB",
        base1024Exponent: 3,
    },
};

const PublishPort = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <InputGroup className='ct-input-group-spacer-sm' id={id}>
                <TextInput aria-label={_("IP (optional)")}
                           type='text'
                           placeholder={_("IP (optional)")}
                           value={item.IP || ''}
                           onChange={value => onChange(idx, 'IP', value)} />
                <TextInput aria-label={_("Host port (optional)")}
                           type='number'
                           step={1}
                           min={1}
                           max={65535}
                           placeholder={_("Host port (optional)")}
                           value={item.hostPort || ''}
                           onChange={value => onChange(idx, 'hostPort', value)} />
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.IP && !item.hostPort && !item.containerPort ? ' invisible' : '')}
                        isSmall
                        aria-label={_("Remove item")}
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary' className="btn-add" onClick={additem} aria-label={_("Add item")} icon={<PlusIcon />} />
            </InputGroup>
            <InputGroup className='ct-input-group-spacer-sm'>
                <TextInput aria-label={_("Container port")}
                           type='number'
                           step={1}
                           min={1}
                           max={65535}
                           placeholder={_("Container port")}
                           value={item.containerPort || ''}
                           onChange={value => onChange(idx, 'containerPort', value)} />
                <FormSelect className='pf-c-form-control container-port-protocol'
                            aria-label={_("Protocol")}
                            value={item.protocol}
                            onChange={value => onChange(idx, 'protocol', value)}>
                    <FormSelectOption value='tcp' key='tcp' label={_("TCP")} />
                    <FormSelectOption value='udp' key='udp' label={_("UDP")} />
                </FormSelect>
            </InputGroup>
        </>
    );

const EnvVar = ({ id, item, onChange, idx, removeitem, additem }) =>
    (
        <>
            <InputGroup className="ct-input-group-spacer-sm" id={id}>
                <TextInput aria-label={_("Key")}
                           type='text'
                           placeholder={_("Key")}
                           value={item.envKey || ''}
                           onChange={value => onChange(idx, 'envKey', value)} />
                <TextInput aria-label={_("Value")}
                           type='text'
                           placeholder={_("Value")}
                           value={item.envValue || ''}
                           onChange={value => onChange(idx, 'envValue', value)} />
                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.envKey && !item.envValue ? ' invisible' : '')}
                        isSmall
                        aria-label={_("Remove item")}
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary'
                    className="btn-add"
                    onClick={additem}
                    icon={<PlusIcon />}
                    aria-label={_("Add item")} />
            </InputGroup>
        </>
    );

const Volume = ({ id, item, onChange, idx, removeitem, additem, options }) =>
    (
        <>
            <InputGroup className='ct-input-group-spacer-sm' id={id || ''}>
                <FileAutoComplete aria-label={_("Host path")}
                                  placeholder={_("Host path")}
                                  value={item.hostPath || ''}
                                  onChange={ value => onChange(idx, 'hostPath', value) } />
                <TextInput aria-label={_("Container path")}
                           placeholder={_("Container path")}
                           value={item.containerPath || ''}
                           onChange={value => onChange(idx, 'containerPath', value)} />

                <Button variant='secondary'
                        className={"btn-close" + (idx === 0 && !item.containerPath && !item.hostPath ? ' invisible' : '')}
                        aria-label={_("Remove item")}
                        isSmall
                        icon={<CloseIcon />}
                        onClick={() => removeitem(idx)} />
                <Button variant='secondary'
                        className="btn-add"
                        onClick={additem}
                        isSmall
                        icon={<PlusIcon />}
                        aria-label={_("Add item")} />
            </InputGroup>
            <InputGroup className='ct-input-group-spacer-sm'>
                <FormSelect className='pf-c-form-control'
                            aria-label={_("Mode")}
                            value={item.mode}
                            onChange={value => onChange(idx, 'mode', value)}>
                    <FormSelectOption value='ro' key='ro' label={_("ReadOnly")} />
                    <FormSelectOption value='rw' key='rw' label={_("ReadWrite")} />
                </FormSelect>
                { options && options.selinuxAvailable &&
                    <FormSelect className='pf-c-form-control'
                                aria-label={_("SELinux label")}
                                value={item.selinux}
                                onChange={value => onChange(idx, 'selinux', value)}>
                        <FormSelectOption value='' key='' label={_("No SELinux label")} />
                        <FormSelectOption value='z' key='z' label={_("Shared")} />
                        <FormSelectOption value='Z' key='Z' label={_("Private")} />
                    </FormSelect>
                }
            </InputGroup>
        </>
    );

class DynamicListForm extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [Object.assign({ key: 0 }, props.default)],
        };
        this.keyCounter = 1;
        this.removeItem = this.removeItem.bind(this);
        this.addItem = this.addItem.bind(this);
        this.onItemChange = this.onItemChange.bind(this);
    }

    removeItem(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items.splice(idx, 1);
            if (items.length === 0)
                items.push(Object.assign({ key: this.keyCounter++ }, this.props.default));
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    addItem() {
        this.setState(state => {
            return { list: [...state.list, Object.assign({ key: this.keyCounter++ }, this.props.default)] };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    onItemChange(idx, field, value) {
        this.setState(state => {
            const items = state.list.concat();
            items[idx][field] = value || null;
            return { list: items };
        }, () => this.props.onChange(this.state.list.concat()));
    }

    render () {
        const { id, formclass } = this.props;
        const dialogValues = this.state;
        return (
            <>
                {
                    dialogValues.list.map((item, idx) =>
                        (

                            <div className={formclass || ''} key={ item.key } data-key={ item.key }>
                                {
                                    React.cloneElement(this.props.itemcomponent, {
                                        idx: idx, item: item, id: id + "-" + idx,
                                        onChange: this.onItemChange, removeitem: this.removeItem, additem: this.addItem, options: this.props.options,
                                    })
                                }
                            </div>
                        )
                    )
                }
            </>
        );
    }
}
DynamicListForm.propTypes = {
    onChange: PropTypes.func.isRequired,
    id: PropTypes.string.isRequired,
    itemcomponent: PropTypes.object.isRequired,
    formclass: PropTypes.string,
    options: PropTypes.object,
};

export class ImageRunModal extends React.Component {
    constructor(props) {
        super(props);
        let command = "sh";
        if (this.props.image && this.props.image.Command) {
            command = utils.quote_cmdline(this.props.image.Command);
        }

        this.state = {
            command,
            containerName: dockerNames.getRandomName(),
            env: [],
            hasTTY: true,
            publish: [],
            image: props.image,
            memory: 512,
            cpuShares: 1024,
            memoryConfigure: false,
            cpuSharesConfigure: false,
            memoryUnit: 'MiB',
            validationFailed: {},
            volumes: [],
            runImage: true,
            activeTabKey: 0,
            owner: this.props.systemServiceAvailable ? systemOwner : this.props.user,
            /* image select */
            selectedImage: "",
            searchFinished: false,
            searchInProgress: false,
            searchText: "",
            imageResults: {},
            isImageSelectOpen: false,
            imageHelperVariant: "info",
            imageHelperText: "",
        };
        this.getCreateConfig = this.getCreateConfig.bind(this);
        this.onCreateClicked = this.onCreateClicked.bind(this);
        this.onValueChanged = this.onValueChanged.bind(this);
    }

    componentDidMount() {
        this._isMounted = true;
    }

    componentWillUnmount() {
        this._isMounted = false;

        if (this.activeConnection)
            this.activeConnection.close();
    }

    getCreateConfig() {
        const createConfig = {};

        if (this.state.image) {
            createConfig.image = this.state.image.RepoTags ? this.state.image.RepoTags[0] : "";
        } else {
            let img = this.state.selectedImage.Name;
            // Make implicit :latest
            if (!img.includes(":")) {
                img += ":latest";
            }
            createConfig.image = img;
        }
        if (this.state.containerName)
            createConfig.name = this.state.containerName;
        if (this.state.command) {
            createConfig.command = utils.unquote_cmdline(this.state.command);
        }
        const resourceLimit = {};
        if (this.state.memoryConfigure && this.state.memory) {
            const memorySize = this.state.memory * (1024 ** units[this.state.memoryUnit].base1024Exponent);
            resourceLimit.memory = { limit: memorySize };
            createConfig.resource_limits = resourceLimit;
        }
        if (this.state.cpuSharesConfigure && this.state.cpuShares !== 0) {
            resourceLimit.cpu = { shares: this.state.cpuShares };
            createConfig.resource_limits = resourceLimit;
        }
        createConfig.terminal = this.state.hasTTY;
        if (this.state.publish.length > 0)
            createConfig.portmappings = this.state.publish
                    .filter(port => port.containerPort)
                    .map(port => {
                        const pm = { container_port: parseInt(port.containerPort), protocol: port.protocol };
                        if (port.hostPort !== null)
                            pm.host_port = parseInt(port.hostPort);
                        if (port.IP !== null)
                            pm.host_ip = port.IP;
                        return pm;
                    });
        if (this.state.env.length > 0) {
            const ports = {};
            this.state.env.forEach(item => { ports[item.envKey] = item.envValue });
            createConfig.env = ports;
        }
        if (this.state.volumes.length > 0) {
            createConfig.mounts = this.state.volumes
                    .filter(volume => volume.hostPath && volume.containerPath)
                    .map(volume => {
                        const record = { source: volume.hostPath, destination: volume.containerPath, type: "bind" };
                        record.options = [];
                        if (volume.mode)
                            record.options.push(volume.mode);
                        if (volume.selinux)
                            record.options.push(volume.selinux);
                        return record;
                    });
        }

        return createConfig;
    }

    createContainer = (isSystem, createConfig) => {
        const { runImage } = this.state;
        client.createContainer(isSystem, createConfig)
                .then(reply => {
                    if (runImage) {
                        client.postContainer(isSystem, "start", reply.Id, {})
                                .then(() => this.props.close())
                                .catch(ex => {
                                    this.setState({
                                        dialogError: _("Container failed to be started"),
                                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                                    });
                                });
                    } else {
                        this.props.close();
                    }
                })
                .catch(ex => {
                    this.setState({
                        dialogError: _("Container failed to be created"),
                        dialogErrorDetail: cockpit.format("$0: $1", ex.reason, ex.message)
                    });
                });
    }

    onCreateClicked() {
        const createConfig = this.getCreateConfig();
        const { owner } = this.state;

        // TODO: correct?
        let isSystem = false;
        if (this.state.image && this.state.image.isSystem) {
            isSystem = true;
        }
        if (!this.state.image && owner === systemOwner) {
            isSystem = true;
        }

        client.imageExists(isSystem, createConfig.image).then(reply => {
            this.createContainer(isSystem, createConfig);
        })
                .catch(ex => {
                    console.log('image does not exists pull');
                    client.pullImage(isSystem, createConfig.image).then(reply => {
                        console.log('pulled image');
                        this.createContainer(isSystem, createConfig);
                    })
                            .catch(ex => {
                                console.error(ex);
                            });
                });
    }

    onValueChanged(key, value) {
        this.setState({ [key]: value });
    }

    handleTabClick = (event, tabIndex) => {
        // Prevent the form from being submitted.
        event.preventDefault();
        this.setState({
            activeTabKey: tabIndex,
        });
    };

    onSearchTriggered = value => {
        this.setState({ imageResults: {} });

        // Do not call the SearchImage API if the input string  is not at least 2 chars,
        // unless Enter is pressed, which should force start the search.
        // The comparison was done considering the fact that we miss always one letter due to delayed setState
        if (value.length < 2)
            return;

        if (this.activeConnection)
            this.activeConnection.close();

        this.setState({ searchFinished: false, searchInProgress: true });
        this.activeConnection = rest.connect(client.getAddress(this.state.isSystem), this.state.isSystem);

        const options = {
            method: "GET",
            path: client.VERSION + "libpod/images/search",
            body: "",
            params: {
                term: value,
            },
        };
        this.activeConnection.call(options)
                .then(reply => {
                    if (reply && this._isMounted) {
                        const imageResults = JSON.parse(reply);
                        // Group images on registry
                        const images = {};
                        imageResults.forEach(image => {
                            // Strip registry for displaying
                            image.toString = function imageToString() { return this.Name };
                            if (image.Index in images) {
                                images[image.Index].push(image);
                            } else {
                                images[image.Index] = [image];
                            }
                        });
                        // Keep an select images to the full registry map
                        this.setState({
                            imageResults: images || {},
                            searchFinished: true,
                            searchInProgress: false,
                            dialogError: ""
                        });
                    }
                })
                .catch(ex => {
                    if (this._isMounted) {
                        this.setState({
                            searchFinished: true,
                            searchInProgress: false,
                            dialogError: _("Failed to search for new images"),
                            dialogErrorDetail: cockpit.format(_("Failed to search for images: $0"), ex.message ? ex.message : "")
                        });
                    }
                });
    }

    clearImageSelection = () => {
        this.setState({
            selectedImage: "",
            image: "",
            isImageSelectOpen: false,
            imageResults: {},
            searchText: "",
            searchFinished: false,
        });
    }

    onImageSelectToggle = isOpen => {
        const { searchInProgress } = this.state;
        // Don't toggle if we want to search, to allow showing the progress indicator.
        if (searchInProgress) {
            return;
        }
        this.setState({
            isImageSelectOpen: isOpen,
        });
    }

    onImageSelect = (event, value, placeholder) => {
        // Skip placeholder elements such as search/progress
        if (placeholder) {
            event.stopPropagation();
            return false;
        }

        this.setState({
            selectedImage: value,
            isImageSelectOpen: false,
        });

        //
        console.log('onImageSelect');
        this.verifySelectedImage(value);
    }

    verifySelectedImage = value => {
        if (!value) {
            this.setState({ imageHelperText: "", imageHelperVariant: "" });
            return;
        }

        // Local images have an Id field
        if (value.Id) {
            this.setState({ imageHelperText: _("Local image will be used"), imageHelperVariant: "success" });
            return;
        }

        // Remote image
        if (value) {
            console.log(value);
            this.setState({ imageHelperText: _("Checking remote"), imageHelperVariant: "" });

            this.activeConnection = rest.connect(client.getAddress(this.state.isSystem), this.state.isSystem);
            const options = {
                method: "GET",
                path: client.VERSION + "libpod/images/search",
                body: "",
                params: {
                    term: value,
                    listTags: true,
                },
            };

            this.activeConnection.call(options)
                    .then(reply => {
                        if (reply && this._isMounted) {
                            const results = JSON.parse(reply);
                            console.log(results);
                            this.setState({
                                imageHelperText: _("Image will be downloaded"),
                                imageHelperVariant: "success"
                            });
                        }
                    })
                    .catch(ex => {
                        if (this._isMounted) {
                            this.setState({
                                imageHelperText: _("Remote image does not exist"),
                                imageHelperVariant: "error"
                            });
                        }
                    });
        }
    };

    handleImageSelectInput = value => {
        this.setState({
            searchText: value,
            // Reset searchFinished status when text input changes
            searchFinished: false,
            selectedImage: "",
            imageResults: {},
        });
    }

    handleOwnerSelect = (_, event) => {
        const id = event.currentTarget.id;
        this.setState({
            owner: id
        });
    }

    filterImages = () => {
        const { localImages } = this.props;
        const { imageResults, searchFinished, searchInProgress, searchText, owner } = this.state;
        const local = _("Local images");
        const images = { ...imageResults };
        const isSystem = owner == systemOwner;

        const imageRegistries = [local].concat(Object.keys(imageResults));
        images[local] = localImages;

        let regexString = searchText;
        // Strip image registry option if set for comparing results for docker.io searching for docker.io/fedora
        // returns docker.io/$username/fedora for example.
        if (regexString.includes('/')) {
            regexString = searchText.replace(searchText.split('/')[0], '');
        }
        const input = new RegExp(regexString, 'i');

        const results = imageRegistries.map((reg, index) => {
            const filtered = images[reg].filter(image => {
                if ('isSystem' in image && image.isSystem && !isSystem) {
                    return false;
                }
                if ('isSystem' in image && !image.isSystem && isSystem) {
                    return false;
                }
                if (searchText.length < 3) {
                    return true;
                }
                return image.Name.search(input) !== -1;
            }).map((image, index) => {
                return (
                    <SelectOption
              key={index}
              value={image}
              {...(image.Description && { description: image.Description })}
                    />);
            });

            if (filtered.length === 0) {
                return [];
            } else {
                return (
                    <SelectGroup label={reg} key={index}>
                        {filtered}
                    </SelectGroup>
                );
            }
        }).filter(group => group.length !== 0); // filter out empty groups

        const noResults = results.length === 0 && searchFinished;
        if (noResults) {
            results.push(<SelectOption key="notfound" isPlaceholder isDisabled value={_("No images found")} />);
        }

        // Add the search component
        const searchComponent = (<SelectOption key="search"
                                              isPlaceholder
                                              onClick={() => this.onSearchTriggered(searchText)}>
            <Flex>
                <FlexItem spacer={{ default: 'spacerSm' }}><SearchIcon className="image-select-search-option" /></FlexItem>
                <FlexItem className="image-select-search-option"> {cockpit.format(_("Search all registries: $0"), searchText)}</FlexItem>
            </Flex>
        </SelectOption>
        );

        // Don't show the search component
        if (searchText && !searchFinished) {
            results.push(searchComponent);
        }

        const spinner = <SelectOption key="spinner" isLoading isPlaceholder><Spinner size="lg" /></SelectOption>;
        if (searchInProgress) {
            results.push(spinner);
        }

        return results;
    }

    render() {
        const { image } = this.props;
        const dialogValues = this.state;
        const { activeTabKey, owner, searchText, selectedImage } = this.state;

        // TODO: refactor ImageSelect to a new functional component
        let imageListOptions = [];
        if (!image) {
            imageListOptions = this.filterImages();
        }

        const defaultBody = (
            <Form isHorizontal>
                <Flex>
                    <FlexItem align={{ default: 'alignLeft' }}>
                        <FormGroup fieldId='run-image-dialog-name' label={_("Name")}>
                            <TextInput id='run-image-dialog-name'
                               placeholder={_("Container name")}
                               value={dialogValues.containerName}
                               onChange={value => this.onValueChanged('containerName', value)} />
                        </FormGroup>
                    </FlexItem>
                    { this.props.userServiceAvailable && this.props.systemServiceAvailable &&
                    <FlexItem align={{ default: 'alignRight' }}>
                        <FormGroup fieldId='run-image-dialog-owner' label={_("Owner")}>
                            <ToggleGroup aria-label="Default with single selectable">
                                <ToggleGroupItem text={_("System")} buttonId="system" isSelected={owner === "system"}
                                                 onChange={this.handleOwnerSelect} />
                                <ToggleGroupItem text={cockpit.format("$0 $1", _("User:"), this.props.user)}
                                                 buttonId={this.props.user}
                                                 isSelected={owner === this.props.user}
                                                 onChange={this.handleOwnerSelect} />
                            </ToggleGroup>
                        </FormGroup>
                    </FlexItem>
                    }
                </Flex>
                <Tabs activeKey={activeTabKey} onSelect={this.handleTabClick}>
                    <Tab eventKey={0} title={<TabTitleText>{_("Details")}</TabTitleText>} className="pf-l-grid pf-m-gutter">

                        {!image &&
                        <FormGroup fieldId="create-image-image-select" label={_("Image")} labelIcon={
                            <Popover aria-label={_("Image selection help")}
                        enableFlip
                        bodyContent={_("host[:port]/[user]/container[:tag].")}>
                                <button onClick={e => e.preventDefault()} className="pf-c-form__group-label-help">
                                    <OutlinedQuestionCircleIcon />
                                </button>
                            </Popover>
                        }
                        >
                            <Select id='create-image-image-select'
                                menuAppendTo={() => document.body}
                                variant={SelectVariant.typeahead}
                                noResultsFoundText={_("No images found")}
                                onToggle={this.onImageSelectToggle}
                                isOpen={this.state.isImageSelectOpen}
                                isInputValuePersisted
                                // Fallback to searchText to not clear the search input after clicking on "Search Registries for X"
                                selections={selectedImage || searchText}
                                placeholderText={_("Search string or container location")}
                                onSelect={this.onImageSelect}
                                onFilter={() => {
                                }}
                                onClear={this.clearImageSelection}
                                onTypeaheadInputChanged={this.handleImageSelectInput}
                            >
                                {imageListOptions}
                            </Select>
                            <HelperText>
                                <HelperTextItem variant={this.state.imageHelperVariant}>{this.state.imageHelperText}</HelperTextItem>
                            </HelperText>
                        </FormGroup>
                        }

                        {image &&
                        <FormGroup fieldId='run-image-dialog-image' label={_("Image")} hasNoPaddingTop>
                            <div id='run-image-dialog-image'> { image.RepoTags ? image.RepoTags[0] : "" } </div>
                        </FormGroup>
                        }

                        <FormGroup fieldId='run-image-dialog-command' label={_("Command")}>
                            <TextInput id='run-image-dialog-command'
                           placeholder={_("Command")}
                           value={dialogValues.command || ''}
                           onChange={value => this.onValueChanged('command', value)} />
                        </FormGroup>

                        <FormGroup fieldId="run=image-dialog-tty">
                            <Checkbox id="run-image-dialog-tty"
                              isChecked={this.state.hasTTY}
                              label={_("With terminal")}
                              onChange={checked => this.onValueChanged('hasTTY', checked)} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-memory' label={_("Memory limit")}>
                            <InputGroup className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-memory-limit">
                                <Checkbox id="run-image-dialog-memory-limit-checkbox"
                                  className="pf-u-align-content-center"
                                  isChecked={this.state.memoryConfigure}
                                  onChange={checked => this.onValueChanged('memoryConfigure', checked)} />
                                <TextInput type='number'
                                   value={dialogValues.memory}
                                   id="run-image-dialog-memory"
                                   className="dialog-run-form-input"
                                   step={1}
                                   min={0}
                                   isReadOnly={!this.state.memoryConfigure}
                                   onChange={value => this.onValueChanged('memory', value)} />
                                <FormSelect id='memory-unit-select'
                                    aria-label={_("Memory unit")}
                                    value={this.state.memoryUnit}
                                    isDisabled={!this.state.memoryConfigure}
                                    className="dialog-run-form-select"
                                    onChange={value => this.onValueChanged('memoryUnit', value)}>
                                    <FormSelectOption value={units.KiB.name} key={units.KiB.name} label={_("KiB")} />
                                    <FormSelectOption value={units.MiB.name} key={units.MiB.name} label={_("MiB")} />
                                    <FormSelectOption value={units.GiB.name} key={units.GiB.name} label={_("GiB")} />
                                </FormSelect>
                            </InputGroup>
                        </FormGroup>

                        { this.state.image && this.state.image.isSystem &&
                            <FormGroup fieldId='run-image-cpu-priority' label={_("CPU shares")}>
                                <InputGroup className="ct-input-group-spacer-sm modal-run-limiter" id="run-image-dialog-cpu-priority">
                                    <Checkbox id="run-image-dialog-cpu-priority-checkbox"
                                        className="pf-u-align-content-center"
                                        isChecked={this.state.cpuSharesConfigure}
                                        onChange={checked => this.onValueChanged('cpuSharesConfigure', checked)} />
                                    <TextInput type='number'
                                        id="run-image-cpu-priority"
                                        value={dialogValues.cpuShares}
                                        step={1}
                                        min={2}
                                        max={262144}
                                        isReadOnly={!this.state.cpuSharesConfigure}
                                        onChange={value => this.onValueChanged('cpuShares', parseInt(value))} />
                                </InputGroup>
                            </FormGroup>}

                        <FormGroup fieldId='run-image-dialog-start-after-creation' label={_("Start after creation")} hasNoPaddingTop>
                            <Checkbox isChecked={this.state.runImage} id="run-image-dialog-start-after-creation" onChange={value => this.onValueChanged('runImage', value)} />
                        </FormGroup>
                    </Tab>
                    <Tab eventKey={1} title={<TabTitleText>{_("Integration")}</TabTitleText>} id="create-image-dialog-tab-integration" className="pf-l-grid pf-m-gutter">

                        <FormGroup fieldId='run-image-dialog-publish' label={_("Ports")}>
                            <DynamicListForm id='run-image-dialog-publish'
                                     formclass='publish-port-form'
                                     onChange={value => this.onValueChanged('publish', value)}
                                     default={{ IP: null, containerPort: null, hostPort: null, protocol: 'tcp' }}
                                     itemcomponent={ <PublishPort />} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-volume' label={_("Volumes")}>
                            <DynamicListForm id='run-image-dialog-volume'
                                     formclass='volume-form'
                                     onChange={value => this.onValueChanged('volumes', value)}
                                     default={{ containerPath: null, hostPath: null, mode: 'rw' }}
                                     options={{ selinuxAvailable: this.props.selinuxAvailable }}
                                     itemcomponent={ <Volume />} />
                        </FormGroup>

                        <FormGroup fieldId='run-image-dialog-env' label={_("Environment")}>
                            <DynamicListForm id='run-image-dialog-env'
                                     formclass='env-form'
                                     onChange={value => this.onValueChanged('env', value)}
                                     default={{ envKey: null, envValue: null }}
                                     itemcomponent={ <EnvVar />} />
                        </FormGroup>
                    </Tab>
                </Tabs>
            </Form>
        );
        return (
            <Modal isOpen
                   position="top" variant="medium"
                   onClose={this.props.close}
                   title={_("Create container")}
                   footer={<>
                       {this.state.dialogError && <ErrorNotification errorMessage={this.state.dialogError} errorDetail={this.state.dialogErrorDetail} />}
                       <Button variant='primary' onClick={this.onCreateClicked} isDisabled={!image && selectedImage === ""}>
                           {_("Create")}
                       </Button>
                       <Button variant='link' className='btn-cancel' onClick={ this.props.close }>
                           {_("Cancel")}
                       </Button>
                   </>}
            >
                {defaultBody}
            </Modal>
        );
    }
}
